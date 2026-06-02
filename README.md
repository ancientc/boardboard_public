# BoardBoard

BoardBoard is a collaborative zoomable whiteboard inspired by Miro, TLDraw, Escalidraw, Prezi, built end-to-end on [Cloudflare](https://www.cloudflare.com/). Small teams can create shared boards with sticky notes, text, images, and basic shapes, then edit together in near real time.

The stack is intentionally unified: the Next.js UI, REST APIs, SQL database, object storage, and realtime layer all run on Cloudflare Workers, D1, R2, and Durable Objects—no separate backend platform in the request path.

Cloudflare was chosen because it is secure, fast and cheaper than vercel.com, AWS or Google Cloud. (Decision in June 2026)

This is basic prototype from Zsolt Balai, a developer with following skillsets:
- Service Design / Model Driven Development
- Typescript/React/Next.js/Node.js
- Cloudflare D1 database / R2 data storage
- AI orchestration / token usage optimalizations, ...

Contact him on [zbalai.com](https://www.zbalai.com/) or write an email to zbalai gmail.

This repo is not meant for production yet, additional security checks and audits are needed according to your specific needs.


## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Frontend](#frontend)
- [Backend](#backend)
- [Development](#development)
- [Cloudflare preview and deploy](#cloudflare-preview-and-deploy)
- [Roadmap and possible features](#roadmap-and-possible-features)
- [Project structure](#project-structure)
- [License](#license)

## Features

**Implemented today**

- **Board management** — create boards from the home page, list recent boards, open `/board/[boardId]`
- **Canvas** — pan and zoom (Konva), select, drag, resize, delete objects
- **Object types** — sticky notes, text blocks, images (files referenced by `fileId`)
- **Realtime collaboration** — WebSocket per board via a Cloudflare Durable Object; live object updates and presence (cursors, display names, colors)
- **Persistence** — board objects stored in D1 with fractional `z_index` ordering; debounced flush from the Durable Object
- **File uploads** — metadata in D1, bytes in R2; presigned upload flow (metadata → PUT to R2 → finalize)
- **Access** — link-based collaboration; visitors are recorded as `editor` members on first access
- **Shared contracts** — Zod schemas and TypeScript types shared across client, API routes, and Durable Object

**Planned** (see [Roadmap and possible features](#roadmap-and-possible-features))

- Shapes (rectangle, circle, line, arrow), share tokens, role-based permissions, Auth.js providers (magic link, Google), undo/redo, keyboard shortcuts, board thumbnails, R2 snapshots

## Architecture

Everything runs on Cloudflare. The browser talks HTTPS to a Worker that hosts the OpenNext-built Next.js app; WebSocket upgrades for a board are intercepted and routed to one Durable Object instance per `boardId`.

```text
Browser
  |
  | HTTPS (pages + REST)     WebSocket (board events)
  |
Cloudflare Worker (OpenNext + custom-worker.ts)
  |
  |-- Next.js app (React UI, App Router API routes)
  |     |
  |     |-- Drizzle ORM --> D1 (boards, objects, files, users, events)
  |     |-- R2 binding --> presigned uploads / file content
  |     |
  |     |-- GET /api/boards/:boardId/ws (upgrade)
  |            |
  |            v
  |-- Board Durable Object (script: boardboard-do)
        |
        |-- In-memory authoritative board state + presence
        |-- Validate events (Zod), broadcast to all clients
        |-- Debounced flush of dirty objects to D1 (~2s)
```

### Why these pieces

| Component | Role |
| --- | --- |
| **Next.js + OpenNext** | UI and REST API in one deployable Worker |
| **D1 (SQLite)** | Relational data: users, boards, members, objects, file metadata |
| **R2** | Binary storage for uploads; DB stores keys and metadata only |
| **Durable Object** | One actor per board serializes edits, holds hot state, fans out WebSockets |
| **Drizzle** | Schema and migrations shared by API and DO |
| **Auth.js** | Sessions for API and (eventually) stronger identity providers |
| **Zod** | Shared validation for REST payloads and WebSocket events |

### Record scopes

State is tagged by scope (see `src/shared/scopes.ts`):

| Scope | Synced | Persisted | Examples |
| --- | --- | --- | --- |
| `document` | Yes | Yes (D1) | Sticky notes, text, images |
| `presence` | Yes | No | Cursors, selection, user color |
| `session` | No | No | Current tool, local zoom UI prefs |

High-frequency updates (e.g. cursor moves, drag ticks) are broadcast only; terminal changes are marked dirty and flushed in batches.

### Workers layout

- **`wrangler.toml`** — main Worker (`custom-worker.ts`): OpenNext app, D1, R2, DO binding to `boardboard-do`
- **`wrangler.do.toml`** — Durable Object Worker (`src/worker/do-worker.ts`): exports `BoardDurableObject`

WebSocket routing in `custom-worker.ts` matches `/api/boards/:boardId/ws`, resolves the DO stub by `boardId`, and forwards the upgrade.

## Frontend

**Stack:** Next.js 15 (App Router), React 19, [Konva](https://konvajs.org/) / `react-konva`, Tailwind CSS 4, Zustand.

### Pages and layout

| Route | Purpose |
| --- | --- |
| `/` | Home — board grid, create-board dialog |
| `/board/[boardId]` | Collaborative canvas — toolbar, tool palette, canvas, properties panel, participants, zoom |

### Object model

Each object type has a small “util” module under `src/lib/object-utils/`:

- Default props (`data_json` shape)
- Geometry for hit-testing (`src/lib/geometry/`)
- React rendering on the Konva canvas

Supported types today: `sticky_note`, `text`, `image` (see `src/shared/object-types.ts`).

### Editor and tools

`src/lib/editor/` owns mutations—components call `editor.createObject()`, `updateObject()`, `deleteObject()` rather than mutating stores directly. Tools (`src/lib/tools/`) implement select, sticky note, text, and upload flows as small state machines.

### Sync client

`src/lib/sync/sync-client.ts` and `BoardSyncProvider` maintain the WebSocket to the board DO: handshake (`user_joined`), apply `state_snapshot`, merge incoming document/presence events, send optimistic updates.

Local UI state (active tool, panels) lives in Zustand (`src/stores/`).

## Backend

### Data model (D1)

Defined in `src/db/schema.ts` and migrated with Drizzle:

- **`users`** — display name, optional email
- **`boards`** — title, owner, optional `access_token`
- **`board_members`** — `owner` / `editor` / `viewer` roles
- **`board_objects`** — canvas objects: position, size, rotation, fractional `z_index`, `data_json`
- **`files`** — R2 bucket/key, MIME, size, uploader; referenced from image objects via `fileId`
- **`board_events`** — optional audit/replay log

### File upload flow

1. `POST /api/files/presign` — validate board access and MIME/size limits (max 10 MB images)
2. Browser `PUT` bytes to R2 using the presigned URL
3. `POST /api/files/[fileId]/finalize` — persist metadata, create board object
4. Connected clients receive updates via the Durable Object

Content can be served via `/api/files/[fileId]/content` (Worker proxies or signs R2 reads).

### Durable Object

`BoardDurableObject` (`src/worker/board-durable-object.ts`):

- Loads non-deleted objects from D1 on first connection
- Handles `object_created`, `object_updated`, `object_deleted`, presence events
- Broadcasts to all WebSockets; last-write-wins per object
- Flushes dirty rows to D1 after `FLUSH_DELAY_MS` (2 seconds)

Messages are parsed in `src/worker/message-handler.ts` using shared Zod event schemas (`src/shared/schemas/events.ts`).

### API routes (representative)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/boards` | List boards |
| `POST` | `/api/boards` | Create board |
| `GET` | `/api/boards/[boardId]` | Board metadata |
| `GET` | `/api/boards/[boardId]/objects` | Object list (REST fallback) |
| `GET` | `/api/boards/[boardId]/ws` | WebSocket upgrade (Worker/DO in preview/deploy) |
| `POST` | `/api/files/presign` | Start upload |
| `POST` | `/api/files/[fileId]/finalize` | Complete upload |
| `GET` | `/api/session` | Session info |
| `*` | `/api/auth/[...nextauth]` | Auth.js |

Under plain `pnpm dev`, the WebSocket route returns `426` because Durable Objects are not available—use `pnpm preview` for full realtime behavior.

### Auth and access

`src/server/auth.ts` configures Auth.js. `ensureBoardMembership` (`src/server/board-access.ts`) adds link visitors as editors. Stronger sharing (tokens, viewer-only) is specified in `docs/specs/boardboard.md` and planned for a later phase.

## Development

### Prerequisites

- Node.js (LTS)
- [pnpm](https://pnpm.io/)
- Cloudflare account with D1 and R2 (for preview/deploy)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (included as a dev dependency)

### Install and run

```bash
pnpm install
pnpm dev          # Next.js only — no DO/WebSocket
pnpm preview      # OpenNext + Wrangler — full stack locally
```

Copy `.env.example` to `.dev.vars` / environment and set `AUTH_SECRET`, `AUTH_URL`, and Cloudflare IDs as needed.

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production Next.js build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations (local) |
| `pnpm preview` | Build OpenNext bundle and run Wrangler preview |
| `pnpm deploy` | Migrations (remote), deploy DO worker, deploy app |
| `pnpm cf-typegen` | Generate `cloudflare-env.d.ts` from Wrangler |

See [AGENTS.md](./AGENTS.md) for contributor conventions.

## Cloudflare preview and deploy

**Preview** (recommended for collaboration testing):

```bash
pnpm preview
```

**Deploy** (applies remote D1 migrations, deploys `wrangler.do.toml` then the main app):

```bash
pnpm deploy
```

Bindings in `wrangler.toml`: `DB` (D1 `boardboard-db`), `STORAGE` (R2 `boardboard-storage`), `BOARD` (Durable Object `BoardDurableObject` on script `boardboard-do`).

## Roadmap and possible features

Phases are tracked in [`docs/specs/phases.md`](docs/specs/phases.md). The product spec is in [`docs/specs/boardboard.md`](docs/specs/boardboard.md).

### Near term

- **Shapes** — rectangle, circle, line, arrow with stroke/fill
- **Sharing** — share links, optional access tokens, owner/editor/viewer
- **Auth providers** — magic link, Google via Auth.js
- **Usability** — undo/redo, keyboard shortcuts, duplicate, alignment guides
- **Thumbnails** — board preview images in R2 for the home page

### Medium term

- **R2 snapshots** — `boards/{boardId}/snapshots/latest.json` for fast DO cold start
- **Comments and threads** on objects
- **Templates** — retrospective, story map, workshop layouts
- **Export** — PNG/PDF of the board

### Longer term

- **Repository analysis boards** — ingest repo insights as sticky notes and text (spec use case)
- **CRDT or locking** for finer-grained conflict handling
- **Offline-first** clients
- **Mobile**-optimized touch UI
- **Enterprise** permissions, SSO, audit logs

Target scale for the MVP design: ~20 simultaneous users per board with responsive collaboration.

## Project structure

```text
src/
  app/                 # Next.js pages and API routes
  components/          # board/, home/, ui/
  db/                  # Drizzle schema and migrations
  lib/                 # editor, tools, sync, geometry, object-utils
  server/              # auth, files, R2, board access, permissions
  shared/              # types, scopes, Zod schemas
  worker/              # BoardDurableObject, message-handler, do-worker
  stores/              # Zustand UI/board state
custom-worker.ts       # WebSocket intercept + OpenNext handler
wrangler.toml          # Main Worker config
wrangler.do.toml       # Durable Object Worker config
docs/specs/            # Product and phase documentation
```

## License

BoardBoard is released under the [MIT License](./LICENSE).

Copyright (c) 2026 Zsolt Balai zbalai.com

You may use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the conditions in the license file. The software is provided **as is**, without warranty of any kind.
