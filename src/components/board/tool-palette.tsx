"use client";

import type { ReactNode } from "react";
import { ImageUploadButton } from "@/components/board/image-upload-button";
import { useUiStore, type ToolId } from "@/stores/ui-store";

const TOOLS: { id: ToolId; label: string; icon: ReactNode }[] = [
  {
    id: "select",
    label: "Select",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="M13 13l6 6" />
      </svg>
    ),
  },
  {
    id: "sticky_note",
    label: "Sticky note",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
        <path d="M14 3v4a2 2 0 0 0 2 2h4" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6V4h16v2" />
        <path d="M12 4v16" />
        <path d="M9 20h6" />
      </svg>
    ),
  },
];

export function ToolPalette() {
  const currentTool = useUiStore((s) => s.currentTool);
  const setTool = useUiStore((s) => s.setTool);

  return (
    <aside className="absolute left-3 top-16 z-20 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          title={tool.label}
          onClick={() => setTool(tool.id)}
          className={`flex items-center justify-center rounded-md p-2 transition-colors ${
            currentTool === tool.id
              ? "bg-indigo-100 text-indigo-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {tool.icon}
        </button>
      ))}
      <ImageUploadButton />
    </aside>
  );
}
