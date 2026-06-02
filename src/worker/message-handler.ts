import { clientEventSchema } from "@/shared/schemas/events";
import type { BoardDurableObject } from "./board-durable-object";

export function handleMessage(
  dobj: BoardDurableObject,
  ws: WebSocket,
  raw: string,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  const result = clientEventSchema.safeParse(parsed);
  if (!result.success) return;

  const event = result.data;

  switch (event.type) {
    case "user_joined":
      dobj.onJoin(
        ws,
        event.userId ?? "",
        event.payload.displayName,
        event.payload.color,
      );
      break;

    case "object_created":
    case "object_updated":
    case "object_deleted":
      dobj.applyObjectEvent(ws, event);
      dobj.broadcast(raw, ws);
      break;

    case "cursor_moved":
      dobj.updateCursor(ws, event.payload.x, event.payload.y);
      dobj.broadcast(raw, ws);
      break;

    case "selection_changed":
      dobj.broadcast(raw, ws);
      break;
  }
}
