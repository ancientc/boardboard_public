# Phases

1. Static Canvas Prototype -- Next.js app, pan/zoom, sticky notes with local Zustand state, no backend
2. Cloudflare Worker Backend -- API routes, D1/R2 bindings, Drizzle setup, Auth.js, shared Zod schemas
3. D1 Persistence -- board CRUD, save/load objects via Drizzle, first migrations
4. R2 File Storage -- presigned uploads, file metadata, thumbnails
5. Realtime Collaboration -- Board Durable Object, WebSocket, presence, debounced flush
6. Sharing and Permissions -- share links, access tokens, roles, Auth.js providers
7. Usability Improvements -- undo/redo, keyboard shortcuts, duplication, alignment, polish