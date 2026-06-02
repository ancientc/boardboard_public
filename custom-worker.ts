// Custom Cloudflare worker entry. Re-uses the OpenNext-generated fetch handler
// for the Next.js app, intercepts the board WebSocket route and forwards it to
// the per-board Durable Object, and re-exports the Durable Object class so the
// runtime can instantiate it.

import { default as handler } from "./.open-next/worker.js";

interface WorkerEnv {
  BOARD: DurableObjectNamespace;
}

const WS_ROUTE = /^\/api\/boards\/([^/]+)\/ws$/;

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const match = url.pathname.match(WS_ROUTE);

    if (match && request.headers.get("Upgrade") === "websocket") {
      const boardId = match[1];
      const id = env.BOARD.idFromName(boardId);
      const stub = env.BOARD.get(id);
      // Pass the board id to the DO so it can load the right board from D1.
      const doUrl = new URL(request.url);
      doUrl.searchParams.set("boardId", boardId);
      return stub.fetch(new Request(doUrl, request));
    }

    return handler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<WorkerEnv>;
