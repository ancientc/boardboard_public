"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateBoardDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create board");
      const board = (await res.json()) as { id: string };
      setOpen(false);
      setTitle("");
      router.push(`/board/${board.id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New Board</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Create a board">
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Board name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) handleCreate();
            }}
          />
          <Button onClick={handleCreate} disabled={!title.trim() || creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
