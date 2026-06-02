"use client";

import { useEffect, useState } from "react";
import { useBoardStore } from "@/stores/board-store";
import { useBoardSync } from "@/components/board/board-sync-provider";
import { ConnectionStatus } from "@/components/board/connection-status";
import { ShareDialog } from "@/components/board/share-dialog";
import { Button } from "@/components/ui/button";

export function Toolbar() {
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const setSelection = useBoardStore((s) => s.setSelection);
  const { boardId, removeObject } = useBoardSync();

  const [boardTitle, setBoardTitle] = useState<string>("");

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/boards/${boardId}`);
        if (!res.ok) return;
        const board = (await res.json()) as { title?: string };
        if (!cancelled && board.title) setBoardTitle(board.title);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const commitTitle = async () => {
    const title = boardTitle.trim();
    if (!title) return;
    try {
      await fetch(`/api/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {
      // ignore
    }
  };

  const handleDelete = () => {
    for (const id of selectedIds) removeObject(id);
    setSelection([]);
  };

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-12 items-center gap-2 border-b border-gray-200 bg-white px-4 shadow-sm">
      <input
        value={boardTitle}
        onChange={(e) => setBoardTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="Untitled board"
        className="max-w-xs rounded px-1 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-300"
      />
      <ConnectionStatus />
      <div className="flex-1" />
      <Button variant="ghost" size="sm" disabled>
        Undo
      </Button>
      <Button variant="ghost" size="sm" disabled>
        Redo
      </Button>
      {selectedIds.size > 0 && (
        <Button variant="ghost" size="sm" onClick={handleDelete}>
          Delete
        </Button>
      )}
      <ShareDialog />
    </header>
  );
}
