# Basic MIRO-like Board Software — MVP Specification

## 1. Goal and Product Scope

The goal is to create a basic collaborative whiteboard application inspired by MIRO, designed for small teams of up to 20 users per board.

The first version should focus on simplicity, speed, and reliability rather than advanced drawing features. The application should allow users to create a board, invite others, add visual objects, upload small assets, move objects around, and see changes from other users in near real time.
the first version should have only sticky notes, text and a few shapes. It should work on cloudflare.com with cloudflare D1 and R2.
Stack to be used:
Typescript
Drizzle ORM
auth.js
Durable Objects

### MVP Goal

Create a browser-based collaborative board where users can:

- create and open boards
- add sticky notes
- add text blocks
- add simple shapes
- upload small images or files
- move, resize, and delete objects
- see other users' changes
- save the board state
- share a board link with invited users

### Not in the MVP

The first version should not include:

- infinite advanced canvas performance optimization
- complex vector drawing tools
- video chat
- comments and threads
- large media libraries
- offline-first synchronization
- enterprise permissions
- templates marketplace
- mobile-native apps

The MVP should feel like a simple shared visual workspace, not a full MIRO competitor.

---

## 2. Target Users and Main Use Cases

### Target Users

The first version is intended for:

- small teams
- workshop participants
- students
- teachers
- product planning groups
- brainstorming sessions
- early-stage startup teams

The maximum expected usage is around 20 simultaneous users on one board.

### Main Use Cases

1. **Brainstorming**
   Users add sticky notes and organize ideas visually.

2. **Simple Planning**
   Users create columns, cards, labels, and simple diagrams.

3. **Workshop Collaboration**
   A facilitator shares a board link and participants add ideas.

4. **Teaching and Learning**
   A teacher creates visual exercises and students interact with them.

5. **Product Design Notes**
   A team maps user flows, features, screenshots, or app ideas.

6. **Light Asset Sharing**
   Users upload small images or documents that can be placed on the board or linked from the board.

7. **Repository Analysis**
Automatic analysis of a repository and collecting information in form of sticky notes and texts into a board

---

## 3. MVP Features

### Board Management

Users should be able to:

- create a new board
- rename a board
- open an existing board
- delete a board
- share a board by link
- optionally protect a board with a simple access token

### Canvas Features

The canvas should support:

- pan and zoom
- object selection
- drag and drop
- resize
- delete
- duplicate
- basic alignment helpers

### Object Types

The MVP should support these object types:

#### Sticky Note

Fields:

- text
- position
- size
- background color
- author
- created date
- updated date

#### Text Box

Fields:

- text
- position
- size
- font size
- text color

#### Shape

Supported shapes:

- rectangle
- circle
- line
- arrow

Fields:

- position
- size
- stroke color
- fill color
- stroke width

#### Image / File Object

Files are stored in Cloudflare R2. The board database stores metadata and the R2 object key.

Fields:

- file name
- MIME type
- file size
- R2 object key
- preview URL or signed URL
- position
- size
- uploader
- created date

### Collaboration Features

For up to 20 users, the app should support:

- presence indicators
- user cursor position
- object changes appearing for other users
- simple conflict handling
- save after each change or after short debounce

### Authentication

For the MVP, authentication can be simple. The chosen library is **Auth.js** (NextAuth), running inside the Cloudflare Worker / Pages app.

Option A:

- anonymous users with temporary display names (only a session cookie + chosen name)

Option B:

- magic link login via Auth.js Email provider

Option C:

- Google login via Auth.js OAuth provider (added later)

Recommended MVP choice: start with anonymous board access plus display name, then enable Auth.js providers later. The same session cookie should be valid for both the HTTP API and the Durable Object WebSocket endpoint.

---

## 4. Technical Architecture

### Suggested Stack

- **Language:** TypeScript everywhere (frontend, Worker, Durable Object)
- **Frontend:** Next.js with React
- **Hosting:** Cloudflare (Cloudflare Pages or Workers using `@opennextjs/cloudflare`) — single platform for frontend, API, database, storage, and realtime
- **Database:** Cloudflare D1
- **ORM / Migrations:** Drizzle ORM (`drizzle-orm` + `drizzle-kit`) with the D1 driver
- **File Storage:** Cloudflare R2 (direct browser uploads via presigned PUT URLs)
- **API Layer:** Cloudflare Worker handlers (co-located with the Next.js app)
- **Realtime:** Cloudflare Durable Objects — one Durable Object per board, holds in-memory board state and fans out WebSocket events
- **Auth:** Auth.js (NextAuth) — anonymous sessions first, magic link / Google later
- **Canvas:** Konva.js (`react-konva`) or plain HTML/CSS + transforms for the MVP; `tldraw` SDK is worth evaluating since it covers most of phases 1, 5, and 7 out of the box
- **Styling:** Tailwind CSS
- **State Management:** Zustand for local UI state; authoritative collab state lives in the Durable Object
- **Validation:** Zod (shared schemas between client, Worker, and Durable Object)

### Important Architecture Note

Everything runs on Cloudflare. The frontend, the API, the database, the file storage, and the realtime layer all live in the same platform, with the Durable Object co-located with D1 and R2 bindings. There is no second platform in the request path.

```text
Browser
  |
  | HTTPS / WebSocket
  |
Cloudflare (single platform)
  |
  |-- Next.js app (Cloudflare Pages / Workers via @opennextjs/cloudflare)
  |     |
  |     |-- Worker API routes (Drizzle ORM -> D1, presigned R2 URLs)
  |     |
  |     |-- WebSocket upgrade -> Board Durable Object
  |
  |-- Board Durable Object (one per boardId)
  |     |
  |     |-- in-memory authoritative board state
  |     |-- WebSocket fan-out to all connected clients
  |     |-- debounced flush to D1
  |
  |-- Cloudflare D1  (structured board data, via Drizzle)
  |-- Cloudflare R2  (uploaded files, exports, thumbnails)
```

### Why Cloudflare D1?

Cloudflare D1 is a managed serverless SQL database with SQLite semantics. It is a good match for this MVP because the data model is relational, the app is small, and the database should be simple to operate.

D1 should store:

- users
- boards
- board members
- board objects
- object metadata
- event history
- file metadata

### Why Cloudflare R2?

Cloudflare R2 should store binary files such as:

- uploaded images
- PDF files
- exported board snapshots
- board thumbnails
- future template images

R2 is a better place for files than D1. The database should only store metadata and object keys.

### High-Level Architecture

```text
Browser
  |
  | HTTP for REST + WebSocket for realtime
  |
Cloudflare Worker (Next.js app + API routes)
  |
  |-- Drizzle ORM -> Cloudflare D1   (structured board data)
  |-- Cloudflare R2                  (uploaded files, exports, thumbnails)
  |-- Board Durable Object (per boardId)
        |
        |-- in-memory board state + presence
        |-- WebSocket fan-out
        |-- debounced flush to D1
```

### Frontend Responsibilities

The frontend should handle:

- drawing the board UI
- object selection
- object dragging
- temporary local (optimistic) state
- sending updates to the Durable Object via WebSocket
- uploading files directly to R2 via presigned PUT URL
- subscribing to realtime events from the Durable Object

### Frontend Object Model (ShapeUtil-style)

The client separates object **data** (plain JSON, the same shape as the wire and DB record) from object **behavior** (rendering, hit testing, interaction). For each object type — sticky, text, shape, image — define one `ObjectUtil` class with a fixed interface:

- `getDefaultProps()` — initial `data_json` for a freshly-created object.
- `getGeometry(obj)` — returns a `Rectangle2d` / `Ellipse2d` used for hit testing, bounds, and snapping. All hit-test code routes through this single abstraction.
- `component(obj)` — React component that renders the object body.
- `indicator(obj)` — separate React component for the selection outline / hover ring. Rendered in its own layer so selection changes don't re-render the body.
- `onResize`, `onDoubleClick`, `onBeforeCreate`, … — optional lifecycle hooks.

A single `Editor` (or `BoardClient`) instance on the frontend owns:

- the local store of objects
- the WebSocket connection to the Durable Object
- the only mutation API: `editor.createObject()`, `editor.updateObject(id, partial)`, `editor.deleteObject(id)` — never mutate the store directly from a component
- coordinate-space conversion (`screenToPage` / `pageToScreen`); the camera (`x`, `y`, `zoom`) is itself a record

Funneling all mutations through the editor keeps optimistic updates, undo/redo, validation, and sync in one place. Adding a new object type (e.g. arrow, comment card) becomes a single `ObjectUtil` registration instead of a sweep across switch statements.

Tools (select, sticky, text, shape, upload) are implemented as small per-tool state machines (e.g. `Idle → Pointing → Translating → Idle`) so input handling stays cleanly separated from object data.

### Backend Responsibilities

The Cloudflare Worker (REST API) should handle:

- board creation
- user/session handling via Auth.js
- loading initial board state from D1 (via Drizzle)
- permission checks
- issuing presigned R2 PUT URLs for uploads
- storing file metadata in D1 after upload completes
- deleting unused files from R2

The Board Durable Object should handle:

- holding the authoritative live state of one board in memory
- accepting WebSocket connections from clients of that board
- validating incoming events (Zod)
- broadcasting events to all connected clients
- tracking presence (cursors, who's online)
- debounced/throttled flush of object changes to D1
- snapshotting state to D1 on hibernation

---

## 5. Database and File Storage Design

A simple relational model in Cloudflare D1 is enough for the MVP. Cloudflare R2 should be used for uploaded file contents.

The schema below is described as SQL DDL for clarity, but it is defined and migrated through **Drizzle ORM** (`drizzle-orm/d1` + `drizzle-kit`). All application access to D1 goes through Drizzle — the Worker and Durable Object share the same schema module.

### users

Stores users or anonymous participants.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL
);
```

### boards

Stores boards.

```sql
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  owner_user_id TEXT,
  access_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### board_members

Stores board participants and roles.

```sql
CREATE TABLE board_members (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  FOREIGN KEY (board_id) REFERENCES boards(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

Suggested roles:

- owner
- editor
- viewer

### board_objects

Stores visual objects on the board.

```sql
CREATE TABLE board_objects (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  type TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL,
  height REAL,
  rotation REAL DEFAULT 0,
  z_index TEXT NOT NULL DEFAULT 'a0',
  data_json TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (board_id) REFERENCES boards(id)
);
```

**Fractional z-index:** `z_index` is stored as a lexicographically-ordered string (a "fractional index"), not an integer. To insert an object between two existing ones with keys `a0` and `a1`, generate an intermediate key like `a0V`. Use a library such as `fractional-indexing` to compute keys.

This avoids the renumber-everything problem when reordering, and — critically for collaboration — lets two users reorder concurrently without conflicting on integer slots. Rendering simply sorts objects by `z_index` lexicographically.

The `data_json` field can store object-specific properties.

Example sticky note:

```json
{
  "text": "Improve onboarding",
  "backgroundColor": "#FFE066",
  "fontSize": 16
}
```

Example image object:

```json
{
  "fileId": "file_123",
  "alt": "Workshop photo",
  "objectFit": "contain"
}
```

### Assets as First-Class Records

Image and file objects on the board do **not** embed the R2 URL, mime type, dimensions, or bytes. They only carry a `fileId` reference. The authoritative asset record lives in the `files` table.

Consequences:

- **Decoupling.** The image object knows where it sits on the board; the file row knows where the bytes live in R2. Either side can change independently (e.g. a thumbnail generation job updates `files.public_url` without touching any `board_objects` row).
- **Deduplication.** The same uploaded image can be referenced by multiple `board_objects` (e.g. duplicate operation) without re-uploading. Frontend caches by `fileId`.
- **Garbage collection.** A `files` row is eligible for deletion when no `board_objects.data_json` on its board still references it. A background job (Worker cron) can sweep these.
- **Permission boundary.** Issuing a presigned download URL or signed view URL is a per-`fileId` operation, independent of board object lifecycle.

This mirrors how tldraw treats assets: shapes reference assets by id, assets are their own records.

### files

Stores metadata for files uploaded to Cloudflare R2.

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  uploaded_by TEXT,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_bucket TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  public_url TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (board_id) REFERENCES boards(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
```

Recommended R2 key format:

```text
boards/{boardId}/files/{fileId}/{safeFilename}
```

Example:

```text
boards/board_abc/files/file_123/workshop-photo.png
```

### board_events

Optional table for event history.

```sql
CREATE TABLE board_events (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,
  object_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

This table is useful for debugging, undo, replay, and future analytics.

### R2 Storage Rules

R2 should store:

- original uploaded images
- generated thumbnails
- exported board images
- uploaded PDFs or documents

R2 should not store:

- board object positions
- user roles
- board permissions
- realtime presence
- normal object metadata

### File Upload Flow

Recommended MVP upload flow uses **presigned PUT URLs** so the file bytes never pass through the Worker:

1. User selects a file in the browser.
2. Browser sends file metadata (name, MIME, size, boardId) to the Worker.
3. Worker validates board permission and file constraints.
4. Worker generates an R2 presigned PUT URL and returns it together with the planned `r2_key` and a new `fileId`.
5. Browser uploads the file bytes directly to R2 using the presigned URL.
6. Browser notifies the Worker that the upload completed.
7. Worker stores file metadata in D1 (`files` row) and creates a `board_objects` record of type `image` or `file` via the Board Durable Object so other clients see it in realtime.
8. Frontend displays the uploaded object on the board.

---

## 6. Realtime Collaboration Model

Realtime is built on **Cloudflare Durable Objects**. One Durable Object instance per `boardId` is the authoritative live state holder for that board.

### Why Durable Objects

- One actor per board, single-threaded, naturally serializes concurrent edits.
- Holds the full board state in memory while users are connected — no DB round-trip on each event.
- Native WebSocket support with hibernation, so an idle board costs essentially nothing.
- Co-located with D1 and R2 bindings in the same Worker runtime; persistence is a local-region call.
- No external realtime SaaS, no extra billing surface.

### Record Scopes (document / session / presence)

Every piece of state on the board belongs to exactly one of three scopes (borrowed from tldraw's model). The scope is a tag on the record/event type, and it determines what the Durable Object does with it.

| Scope      | Synced between users | Persisted to D1 / R2 | Examples                                                       |
|------------|----------------------|----------------------|----------------------------------------------------------------|
| `document` | yes                  | yes                  | sticky notes, text boxes, shapes, image objects, file refs     |
| `session`  | no — local only      | no                   | current tool, zoom level, last-used color, panel toggles       |
| `presence` | yes                  | no                   | cursor position, current selection, user color, display name   |

Routing rules:

- **`document` events** → validated, applied to in-memory state, broadcast to all connected clients, marked dirty, flushed to D1 (and/or snapshotted to R2) on the persistence cadence.
- **`presence` events** → validated, broadcast to all connected clients. Held only in Durable Object memory; dropped when the user disconnects.
- **`session` events** → never sent to the Durable Object at all. They live entirely in the client's local Zustand store.

This collapses "should this be persisted?" and "should this be synced?" into a single tag on the record type, instead of an ongoing per-feature design debate.

### Object Lifecycle

1. First client opens board `B`. The Worker upgrades to WebSocket and forwards to the Durable Object stub for `B`.
2. Durable Object boots, loads board state from D1 via Drizzle, keeps it in memory.
3. Additional clients connect to the same Durable Object instance.
4. All events go through this single instance.
5. When all clients disconnect, the Durable Object flushes pending changes to D1 and hibernates.

### Events to Sync

Client → Durable Object:

- `object_created`
- `object_updated` (includes transient drag/resize ticks)
- `object_deleted`
- `file_attached` (after presigned upload completes)
- `cursor_moved`
- `selection_changed`

Durable Object → all clients on the board:

- the same event types above, after validation
- `user_joined`
- `user_left`
- `state_snapshot` (sent once to a newly connected client)

All event payloads are validated with Zod schemas shared between client and Durable Object.

### Persistence Strategy (debounced flush)

For 20 users dragging sticky notes, writing to D1 on every event would be both expensive and slow. The Durable Object owns the persistence cadence:

- **In-memory state is the source of truth while the board is live.**
- High-frequency events (`cursor_moved`, drag/resize ticks of `object_updated`) are **broadcast only** — never persisted.
- Terminal events (drag-end, text commit, `object_created`, `object_deleted`, `file_attached`) mark the affected object as dirty.
- A debounced flush job (e.g. ~500ms idle or every ~2s under load) writes dirty objects to D1 in a single batched transaction via Drizzle.
- On hibernation or graceful shutdown, the Durable Object flushes all dirty state before sleeping.
- On boot, the Durable Object reloads state from D1.

For file uploads, see §5 "File Upload Flow" — the file metadata is written to D1 by the Worker, and the Durable Object is notified so it can broadcast `file_attached` to other clients.

### Snapshot-to-R2 (complement to the D1 flush)

The D1 flush above is the right model for *queryable* data: listing boards, computing membership, finding files, doing analytics. But the document itself — the full set of `document`-scope records as they exist live in the Durable Object — is also worth persisting as a single JSON blob in R2:

- The Durable Object periodically writes a full board snapshot to R2 at `boards/{boardId}/snapshots/latest.json`, plus an occasional timestamped copy at `boards/{boardId}/snapshots/{iso8601}.json` for history.
- On boot, the Durable Object loads from the R2 snapshot (one fast object read) and only falls back to a D1 / Drizzle replay if R2 is empty or corrupted.
- D1 remains the canonical queryable store, still updated by the debounced flush. The R2 snapshot serves the hot path.

This is the same pattern tldraw's Cloudflare sync uses, and it earns its place in two ways:

- Boot is one R2 read instead of N D1 selects — important when boards grow past a few hundred objects.
- The R2 snapshot becomes a natural unit for thumbnails, exports, undo history, and templates.

The MVP can start with **just the D1 flush** and add the R2 snapshot pattern in Phase 7 (or earlier if boot latency starts to matter).

### Conflict Handling

For the MVP, use a simple **last-write-wins** strategy per object. Because the Durable Object serializes events for a given board, "last" is well-defined: it's whichever event the Durable Object processes last.

- If two users edit the same sticky note, the latest update wins.
- Each object carries an `updated_at` timestamp and an incrementing `version` for sanity checks.
- Later versions can add per-object locking, soft selection ownership, or CRDT-based merging.

### Presence

Presence is `presence`-scope (see above): broadcast to all clients, held in Durable Object memory only, never written to D1.

```json
{
  "userId": "user_123",
  "displayName": "Anna",
  "cursor": {
    "x": 120,
    "y": 400
  },
  "color": "#4F46E5"
}
```

---

## 7. User Interface Structure

### Main Screens

#### Home Page

Purpose:

- create new board
- list recent boards
- enter shared board link

#### Board Page

Purpose:

- show the collaborative canvas
- provide object tools
- upload files
- show connected users

Suggested route:

```text
/board/[boardId]
```

### Board Layout

The board page should contain:

- top toolbar
- left tool palette
- main canvas
- right properties panel
- bottom zoom controls
- small participant list

### Toolbar

The toolbar should include:

- select tool
- sticky note tool
- text tool
- shape tool
- upload image/file button
- undo
- redo
- zoom
- share button

### Object Interaction

Basic interactions:

- click object to select
- drag object to move
- drag corner handle to resize
- double click sticky note to edit text
- double click text box to edit text
- press delete to remove selected object
- upload an image and place it on the board

### Visual Style

The UI should be:

- clean
- friendly
- light
- minimal
- easy for non-technical users

Avoid too many controls in the first version.

---

## 8. Implementation Plan

### Phase 1 — Static Canvas Prototype

Build:

- Next.js + TypeScript project, deployable to Cloudflare via `@opennextjs/cloudflare`
- board page
- pan and zoom
- add sticky notes
- move objects locally with Zustand
- no database yet

Goal:

Validate the user experience.

### Phase 2 — Cloudflare Worker Backend

Build:

- Worker API routes (same project as the Next.js app)
- D1 database binding
- R2 bucket binding
- Drizzle ORM schema + `drizzle-kit` migration setup
- Auth.js with anonymous-session provider
- shared Zod schemas

Goal:

Create a clean backend boundary before persistence becomes complex.

### Phase 3 — D1 Persistence

Build:

- board creation
- save board objects (via Drizzle)
- load board objects
- basic object CRUD API
- first migrations applied to D1

Goal:

A board can be saved and reopened.

### Phase 4 — R2 File Storage

Build:

- presigned PUT URL endpoint
- direct browser → R2 upload
- file metadata table in D1
- R2 object key naming
- file deletion
- basic thumbnails or preview URLs

Goal:

Users can upload and place simple files on the board.

### Phase 5 — Realtime Collaboration (Durable Objects)

Build:

- Board Durable Object class
- WebSocket endpoint that routes to the per-board Durable Object
- in-memory state load from D1 on boot
- event broadcast (object create/update/delete, cursor, presence)
- debounced flush of dirty objects to D1
- hibernation-safe snapshot

Goal:

Two or more users can collaborate at the same time, with D1 writes batched and not on the hot path.

### Phase 6 — Sharing and Permissions

Build:

- share link
- board access token
- owner/editor/viewer roles
- basic board settings
- Auth.js magic link / Google providers

Goal:

Users can safely share a board.

### Phase 7 — Usability Improvements

Build:

- undo/redo
- keyboard shortcuts
- object duplication
- alignment helpers
- nicer toolbar
- board thumbnails stored in R2

Goal:

Make the product pleasant enough for real workshops.

### First Development Milestone

A good first milestone is:

> One user can create a board, add sticky notes, move them around, refresh the browser, and still see the saved board from Cloudflare D1.

### Second Development Milestone

The second milestone is:

> One user can upload an image, store it in Cloudflare R2, and place it on the board.

### Third Development Milestone

The third milestone is:

> Two users can open the same board and see sticky note movement in near real time.

### Success Criteria

The MVP is successful when:

- it works reliably with 20 users
- board state is saved correctly in D1
- uploaded files are stored correctly in R2
- collaboration feels responsive
- the UI is simple enough for a first-time user
- the entire system runs on Cloudflare (Pages/Workers + D1 + R2 + Durable Objects) without external realtime or storage providers
