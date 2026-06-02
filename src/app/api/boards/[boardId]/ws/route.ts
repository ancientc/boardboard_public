// WebSocket upgrades for this route are intercepted by the custom Cloudflare
// worker (custom-worker.ts) and forwarded to the per-board Durable Object
// before reaching Next.js. This handler only runs for non-upgrade requests
// (e.g. under plain `next dev`, where Durable Objects are unavailable).
export function GET() {
  return new Response("Expected WebSocket (run via `pnpm preview`)", {
    status: 426,
  });
}
