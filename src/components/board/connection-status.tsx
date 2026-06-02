"use client";

import { useBoardSync } from "./board-sync-provider";

const LABELS: Record<string, { text: string; color: string }> = {
  connected: { text: "Live", color: "#2F9E44" },
  connecting: { text: "Connecting", color: "#F08C00" },
  disconnected: { text: "Offline", color: "#ADB5BD" },
};

export function ConnectionStatus() {
  const { status } = useBoardSync();
  const info = LABELS[status] ?? LABELS.disconnected;

  return (
    <span
      className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-500"
      title={`Realtime: ${info.text}`}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: info.color }}
      />
      {info.text}
    </span>
  );
}
