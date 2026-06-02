"use client";

import { create } from "zustand";
import type { BoardObject, PresenceInfo, Camera } from "@/shared/types";

interface BoardState {
  objects: Map<string, BoardObject>;
  presence: Map<string, PresenceInfo>;
  selectedIds: Set<string>;
  camera: Camera;

  setObjects: (objects: BoardObject[]) => void;
  upsertObject: (obj: BoardObject) => void;
  removeObject: (id: string) => void;
  setPresence: (userId: string, info: PresenceInfo) => void;
  removePresence: (userId: string) => void;
  setSelection: (ids: string[]) => void;
  setCamera: (camera: Partial<Camera>) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  objects: new Map(),
  presence: new Map(),
  selectedIds: new Set(),
  camera: { x: 0, y: 0, zoom: 1 },

  setObjects: (objects) =>
    set({
      objects: new Map(objects.map((o) => [o.id, o])),
    }),

  upsertObject: (obj) =>
    set((s) => {
      const next = new Map(s.objects);
      next.set(obj.id, obj);
      return { objects: next };
    }),

  removeObject: (id) =>
    set((s) => {
      const next = new Map(s.objects);
      next.delete(id);
      return { objects: next };
    }),

  setPresence: (userId, info) =>
    set((s) => {
      const next = new Map(s.presence);
      next.set(userId, info);
      return { presence: next };
    }),

  removePresence: (userId) =>
    set((s) => {
      const next = new Map(s.presence);
      next.delete(userId);
      return { presence: next };
    }),

  setSelection: (ids) => set({ selectedIds: new Set(ids) }),

  setCamera: (partial) =>
    set((s) => ({ camera: { ...s.camera, ...partial } })),
}));
