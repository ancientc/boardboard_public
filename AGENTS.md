# AGENTS.md

## Mission

Help modify this repository safely and surgically.
Prefer small, tested changes over broad rewrites.

## Setup

- Install dependencies: `pnpm install`
- Start dev server: `pnpm dev`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Test: `pnpm test`
- Build: `pnpm build`

Use `pnpm` only.

## Working Rules

- Explore before changing code.
- For multi-file changes, write a short plan first.
- Touch only files needed for the task.
- Match existing patterns.
- Do not introduce dependencies without approval.
- Do not edit generated files.
- Do not modify migrations unless explicitly requested.
- Add or update tests when behavior changes.
- Run relevant verification before finishing.

## Architecture Docs

- Feature specs live in `docs/specs/`.
- Architecture decisions live in `docs/adr/`.
- Use these docs as source of truth when present.

## Security

- Never expose or commit secrets.
- Validate external inputs.
- Preserve authorization and tenant scoping.
- Do not log sensitive user data.

## Pull Request / Completion Notes

Always summarize:

- Changed files
- Behavior changed
- Tests/checks run
- Known risks