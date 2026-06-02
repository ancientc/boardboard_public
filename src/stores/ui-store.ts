"use client";

import { create } from "zustand";

export type ToolId = "select" | "sticky_note" | "text";

interface UiState {
  currentTool: ToolId;
  propertiesPanelOpen: boolean;
  lastUsedColor: string;

  setTool: (tool: ToolId) => void;
  togglePropertiesPanel: () => void;
  setLastUsedColor: (color: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentTool: "select",
  propertiesPanelOpen: false,
  lastUsedColor: "#FFE066",

  setTool: (tool) => set({ currentTool: tool }),
  togglePropertiesPanel: () =>
    set((s) => ({ propertiesPanelOpen: !s.propertiesPanelOpen })),
  setLastUsedColor: (color) => set({ lastUsedColor: color }),
}));
