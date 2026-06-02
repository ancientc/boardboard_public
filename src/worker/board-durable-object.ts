import { DurableObject } from "cloudflare:workers";
import { and, eq, isNull } from "drizzle-orm";
import type { BoardObject } from "@/shared/types";
import { getDb, type Db } from "@/db/client";
import { boardObjects } from "@/db/schema";
import { handleMessage } from "./message-handler";

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
}

export interface Session {
  userId: string;
  displayName: string;
  color: string;
  cursor: { x: number; y: number } | null;
}

const FLUSH_DELAY_MS = 2000;

export class BoardDurableObject extends DurableObject<Env> {
  private objects: Map<string, BoardObject> = new Map();
  private dirty: Set<string> = new Set();
  private sessions: Map<WebSocket, Session> = new Map();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;
  private boardId = "";
  private db: Db;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = getDb(env.DB);
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const boardId = url.searchParams.get("boardId");
    if (boardId) this.boardId = boardId;

    if (!this.loaded) {
      await this.loadFromD1();
      this.loaded = true;
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    // Placeholder session until the client sends its `user_joined` handshake.
    this.sessions.set(server, {
      userId: "",
      displayName: "Guest",
      color: "#888",
      cursor: null,
    });

    server.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        handleMessage(this, server, event.data);
      }
    });
    const close = () => this.handleClose(server);
    server.addEventListener("close", close);
    server.addEventListener("error", close);

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Registers the joining user and replies with the full board snapshot. */
  onJoin(
    ws: WebSocket,
    userId: string,
    displayName: string,
    color: string,
  ) {
    this.sessions.set(ws, { userId, displayName, color, cursor: null });

    const snapshot = {
      type: "state_snapshot",
      scope: "document",
      boardId: this.boardId,
      timestamp: new Date().toISOString(),
      payload: {
        objects: Array.from(this.objects.values()).filter(
          (o) => !o.deletedAt,
        ),
        presence: this.presenceList(ws),
      },
    };
    try {
      ws.send(JSON.stringify(snapshot));
    } catch {
      // socket already gone
    }

    // Tell everyone else this user joined.
    this.broadcast(
      JSON.stringify({
        type: "user_joined",
        scope: "presence",
        boardId: this.boardId,
        userId,
        timestamp: new Date().toISOString(),
        payload: { displayName, color },
      }),
      ws,
    );
  }

  private presenceList(exclude: WebSocket) {
    const list: {
      userId: string;
      displayName: string;
      color: string;
      cursor: { x: number; y: number } | null;
    }[] = [];
    for (const [sock, s] of this.sessions) {
      if (sock === exclude || !s.userId) continue;
      list.push({
        userId: s.userId,
        displayName: s.displayName,
        color: s.color,
        cursor: s.cursor,
      });
    }
    return list;
  }

  /** Applies a create/update/delete object event to in-memory state. */
  applyObjectEvent(
    ws: WebSocket,
    event:
      | {
          type: "object_created";
          payload: {
            objectId: string;
            objectType: string;
            x: number;
            y: number;
            width: number | null;
            height: number | null;
            rotation: number;
            zIndex: string;
            dataJson: string;
          };
        }
      | { type: "object_updated"; payload: { objectId: string; partial: Record<string, unknown> } }
      | { type: "object_deleted"; payload: { objectId: string } },
  ) {
    const now = new Date().toISOString();
    const session = this.sessions.get(ws);

    if (event.type === "object_created") {
      const p = event.payload;
      const existing = this.objects.get(p.objectId);
      this.objects.set(p.objectId, {
        id: p.objectId,
        boardId: this.boardId,
        type: p.objectType as BoardObject["type"],
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        rotation: p.rotation,
        zIndex: p.zIndex,
        dataJson: p.dataJson,
        createdBy: existing?.createdBy ?? session?.userId ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      });
      this.markDirty(p.objectId);
    } else if (event.type === "object_updated") {
      const existing = this.objects.get(event.payload.objectId);
      if (!existing) return;
      this.objects.set(event.payload.objectId, {
        ...existing,
        ...(event.payload.partial as Partial<BoardObject>),
        updatedAt: now,
      });
      this.markDirty(event.payload.objectId);
    } else {
      const existing = this.objects.get(event.payload.objectId);
      if (!existing) return;
      this.objects.set(event.payload.objectId, {
        ...existing,
        deletedAt: now,
        updatedAt: now,
      });
      this.markDirty(event.payload.objectId);
    }
  }

  updateCursor(ws: WebSocket, x: number, y: number) {
    const session = this.sessions.get(ws);
    if (session) session.cursor = { x, y };
  }

  private async handleClose(ws: WebSocket) {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);
    if (session?.userId) {
      this.broadcast(
        JSON.stringify({
          type: "user_left",
          scope: "presence",
          boardId: this.boardId,
          userId: session.userId,
          timestamp: new Date().toISOString(),
          payload: {},
        }),
      );
    }
    if (this.sessions.size === 0) {
      await this.flush();
    }
  }

  broadcast(message: string, exclude?: WebSocket) {
    for (const ws of this.sessions.keys()) {
      if (ws !== exclude) {
        try {
          ws.send(message);
        } catch {
          // dead socket
        }
      }
    }
  }

  markDirty(objectId: string) {
    this.dirty.add(objectId);
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_DELAY_MS);
  }

  private async flush() {
    if (this.dirty.size === 0) return;
    const ids = Array.from(this.dirty);
    this.dirty.clear();

    for (const id of ids) {
      const o = this.objects.get(id);
      if (!o) continue;
      await this.db
        .insert(boardObjects)
        .values({
          id: o.id,
          boardId: o.boardId,
          type: o.type,
          x: o.x,
          y: o.y,
          width: o.width,
          height: o.height,
          rotation: o.rotation,
          zIndex: o.zIndex,
          dataJson: o.dataJson,
          createdBy: o.createdBy,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          deletedAt: o.deletedAt,
        })
        .onConflictDoUpdate({
          target: boardObjects.id,
          set: {
            x: o.x,
            y: o.y,
            width: o.width,
            height: o.height,
            rotation: o.rotation,
            zIndex: o.zIndex,
            dataJson: o.dataJson,
            updatedAt: o.updatedAt,
            deletedAt: o.deletedAt,
          },
        });
    }
  }

  private async loadFromD1() {
    if (!this.boardId) return;
    const rows = await this.db
      .select()
      .from(boardObjects)
      .where(
        and(
          eq(boardObjects.boardId, this.boardId),
          isNull(boardObjects.deletedAt),
        ),
      )
      .all();
    for (const row of rows) {
      this.objects.set(row.id, row as BoardObject);
    }
  }
}
