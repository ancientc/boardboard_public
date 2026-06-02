"use client";

import { useBoardStore } from "@/stores/board-store";

export function ZoomControls() {
  const zoom = useBoardStore((s) => s.camera.zoom);
  const setCamera = useBoardStore((s) => s.setCamera);

  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-sm">
      <button
        className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
        onClick={() => setCamera({ zoom: Math.max(0.1, zoom - 0.1) })}
      >
        -
      </button>
      <span className="min-w-[3rem] text-center text-xs text-gray-500">
        {Math.round(zoom * 100)}%
      </span>
      <button
        className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
        onClick={() => setCamera({ zoom: Math.min(5, zoom + 0.1) })}
      >
        +
      </button>
    </div>
  );
}
