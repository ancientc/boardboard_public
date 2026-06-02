"use client";

import { useEffect, useState } from "react";
import { BoardCard } from "@/components/home/board-card";
import { CreateBoardDialog } from "@/components/home/create-board-dialog";

interface BoardSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export default function HomePage() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/boards");
        if (res.ok) {
          const data = (await res.json()) as { boards: BoardSummary[] };
          if (!cancelled) setBoards(data.boards);
        }
      } catch {
        // ignore network errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">BoardBoard</h1>
          <CreateBoardDialog />
        </div>
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="col-span-full py-16 text-center text-sm text-gray-400">
              Loading boards…
            </p>
          ) : boards.length === 0 ? (
            <p className="col-span-full py-16 text-center text-sm text-gray-400">
              No boards yet. Create one to get started.
            </p>
          ) : (
            boards.map((board) => (
              <BoardCard
                key={board.id}
                id={board.id}
                title={board.title}
                updatedAt={board.updatedAt}
              />
            ))
          )}
        </section>
      </div>
    </main>
  );
}
