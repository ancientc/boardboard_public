"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBoardStore } from "@/stores/board-store";
import { SyncClient, type SyncStatus } from "@/lib/sync/sync-client";
import type { BoardObject } from "@/shared/types";
import type { ClientEvent, ServerEvent } from "@/shared/schemas/events";

export interface Guest {
  userId: string;
  displayName: string;
  color: string;
}

interface BoardSyncContextValue {
  boardId: string;
  guest: Guest | null;
  status: SyncStatus;
  setDisplayName: (name: string) => Promise<void>;
  upsertObject: (obj: BoardObject) => void;
  removeObject: (id: string) => void;
  sendCursor: (x: number, y: number) => void;
}

const BoardSyncContext = createContext<BoardSyncContextValue | null>(null);

// D1 rows allow nulls where the client expects concrete values; normalize.
function normalizeObject(raw: Record<string, unknown>): BoardObject {
  return {
    id: String(raw.id),
    boardId: String(raw.boardId ?? raw.board_id ?? ""),
    type: raw.type as BoardObject["type"],
    x: Number(raw.x),
    y: Number(raw.y),
    width: raw.width == null ? null : Number(raw.width),
    height: raw.height == null ? null : Number(raw.height),
    rotation: Number(raw.rotation ?? 0),
    zIndex: String(raw.zIndex ?? raw.z_index ?? "a0"),
    dataJson: String(raw.dataJson ?? raw.data_json ?? "{}"),
    createdBy: (raw.createdBy ?? raw.created_by ?? null) as string | null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ""),
    deletedAt: (raw.deletedAt ?? raw.deleted_at ?? null) as string | null,
  };
}

export function BoardSyncProvider({
  boardId,
  children,
}: {
  boardId: string;
  children: ReactNode;
}) {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [status, setStatus] = useState<SyncStatus>("disconnected");

  const clientRef = useRef<SyncClient | null>(null);
  const guestRef = useRef<Guest | null>(null);
  const lastCursorSent = useRef(0);

  guestRef.current = guest;

  const sendJoin = useCallback(() => {
    const g = guestRef.current;
    const client = clientRef.current;
    if (!g || !client) return;
    client.send({
      type: "user_joined",
      scope: "presence",
      boardId,
      userId: g.userId,
      timestamp: new Date().toISOString(),
      payload: { displayName: g.displayName, color: g.color },
    } as ClientEvent);
  }, [boardId]);

  const applyRemote = useCallback(
    (event: ServerEvent) => {
      const store = useBoardStore.getState();
      switch (event.type) {
        case "state_snapshot": {
          store.setObjects(
            event.payload.objects.map((o) =>
              normalizeObject(o as Record<string, unknown>),
            ),
          );
          for (const p of event.payload.presence) {
            const info = p as Record<string, unknown>;
            const userId = String(info.userId ?? "");
            if (!userId) continue;
            store.setPresence(userId, {
              userId,
              displayName: String(info.displayName ?? "Guest"),
              color: String(info.color ?? "#888"),
              cursor:
                (info.cursor as { x: number; y: number } | null) ?? null,
            });
          }
          break;
        }
        case "object_created": {
          const p = event.payload;
          const existing = store.objects.get(p.objectId);
          store.upsertObject({
            id: p.objectId,
            boardId,
            type: p.objectType as BoardObject["type"],
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height,
            rotation: p.rotation,
            zIndex: p.zIndex,
            dataJson: p.dataJson,
            createdBy: existing?.createdBy ?? null,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
          });
          break;
        }
        case "object_updated": {
          const existing = store.objects.get(event.payload.objectId);
          if (!existing) break;
          store.upsertObject({
            ...existing,
            ...(event.payload.partial as Partial<BoardObject>),
            updatedAt: new Date().toISOString(),
          });
          break;
        }
        case "object_deleted":
          store.removeObject(event.payload.objectId);
          break;
        case "cursor_moved": {
          const userId = event.userId;
          if (!userId) break;
          const peer = store.presence.get(userId);
          store.setPresence(userId, {
            userId,
            displayName: peer?.displayName ?? "Guest",
            color: peer?.color ?? "#888",
            cursor: { x: event.payload.x, y: event.payload.y },
          });
          break;
        }
        case "user_joined": {
          // The newcomer learns about existing peers from the join snapshot,
          // so we only need to record them here (no reply, which would loop).
          const userId = event.userId;
          if (!userId) break;
          store.setPresence(userId, {
            userId,
            displayName: event.payload.displayName,
            color: event.payload.color,
            cursor: null,
          });
          break;
        }
        case "user_left":
          if (event.userId) store.removePresence(event.userId);
          break;
      }
    },
    [boardId],
  );

  // Load identity, hydrate from D1 (REST), then open the realtime connection.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [sessionRes, objectsRes] = await Promise.all([
          fetch("/api/session"),
          fetch(`/api/boards/${boardId}/objects`),
        ]);
        if (sessionRes.ok) {
          const g = (await sessionRes.json()) as Guest;
          if (!cancelled) setGuest(g);
        }
        if (objectsRes.ok) {
          const data = (await objectsRes.json()) as {
            objects: Record<string, unknown>[];
          };
          if (!cancelled) {
            useBoardStore
              .getState()
              .setObjects(data.objects.map(normalizeObject));
          }
        }
      } catch {
        // Offline / dev without bindings: canvas still works locally.
      }
    })();

    const client = new SyncClient(boardId);
    clientRef.current = client;
    client.setEventHandler(applyRemote);
    client.setStatusHandler((s) => {
      setStatus(s);
      if (s === "connected") sendJoin();
    });
    client.connect();

    return () => {
      cancelled = true;
      client.disconnect();
      clientRef.current = null;
    };
  }, [boardId, applyRemote, sendJoin]);

  const setDisplayName = useCallback(async (name: string) => {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name }),
    });
    if (res.ok) {
      const g = (await res.json()) as Guest;
      setGuest(g);
      guestRef.current = g;
      // Re-announce presence with the new name.
      const client = clientRef.current;
      if (client) {
        client.send({
          type: "user_joined",
          scope: "presence",
          boardId,
          userId: g.userId,
          timestamp: new Date().toISOString(),
          payload: { displayName: g.displayName, color: g.color },
        } as ClientEvent);
      }
    }
  }, [boardId]);

  const upsertObject = useCallback(
    (obj: BoardObject) => {
      useBoardStore.getState().upsertObject(obj);
      const g = guestRef.current;
      clientRef.current?.send({
        type: "object_created",
        scope: "document",
        boardId,
        userId: g?.userId,
        timestamp: new Date().toISOString(),
        payload: {
          objectId: obj.id,
          objectType: obj.type,
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
          rotation: obj.rotation,
          zIndex: obj.zIndex,
          dataJson: obj.dataJson,
        },
      } as ClientEvent);
    },
    [boardId],
  );

  const removeObject = useCallback(
    (id: string) => {
      useBoardStore.getState().removeObject(id);
      const g = guestRef.current;
      clientRef.current?.send({
        type: "object_deleted",
        scope: "document",
        boardId,
        userId: g?.userId,
        timestamp: new Date().toISOString(),
        payload: { objectId: id },
      } as ClientEvent);
    },
    [boardId],
  );

  const sendCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastCursorSent.current < 40) return;
      lastCursorSent.current = now;
      const g = guestRef.current;
      clientRef.current?.send({
        type: "cursor_moved",
        scope: "presence",
        boardId,
        userId: g?.userId,
        timestamp: new Date().toISOString(),
        payload: { x, y },
      } as ClientEvent);
    },
    [boardId],
  );

  return (
    <BoardSyncContext.Provider
      value={{
        boardId,
        guest,
        status,
        setDisplayName,
        upsertObject,
        removeObject,
        sendCursor,
      }}
    >
      {children}
    </BoardSyncContext.Provider>
  );
}

export function useBoardSync(): BoardSyncContextValue {
  const ctx = useContext(BoardSyncContext);
  if (!ctx) {
    throw new Error("useBoardSync must be used within a BoardSyncProvider");
  }
  return ctx;
}
