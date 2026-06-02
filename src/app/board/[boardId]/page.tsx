"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { BoardSyncProvider } from "@/components/board/board-sync-provider";
import { NamePrompt } from "@/components/board/name-prompt";
import { ParticipantList } from "@/components/board/participant-list";
import { Toolbar } from "@/components/board/toolbar";
import { ToolPalette } from "@/components/board/tool-palette";
import { PropertiesPanel } from "@/components/board/properties-panel";
import { ZoomControls } from "@/components/board/zoom-controls";

const Canvas = dynamic(
  () =>
    import("@/components/board/canvas").then((m) => ({
      default: m.Canvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 z-0 flex items-center justify-center text-gray-400">
        Loading canvas…
      </div>
    ),
  },
);

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = String(params?.boardId ?? "");

  return (
    <BoardSyncProvider boardId={boardId}>
      <div className="relative h-screen w-screen overflow-hidden bg-gray-100">
        <Toolbar />
        <ToolPalette />
        <Canvas />
        <PropertiesPanel />
        <ParticipantList />
        <ZoomControls />
        <NamePrompt />
      </div>
    </BoardSyncProvider>
  );
}
