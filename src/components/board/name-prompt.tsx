"use client";

import { useEffect, useState } from "react";
import { useBoardSync } from "./board-sync-provider";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NamePrompt() {
  const { guest, setDisplayName } = useBoardSync();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (guest && guest.displayName === "Guest") setOpen(true);
  }, [guest]);

  if (!guest) return null;

  const submit = async () => {
    if (!name.trim()) return;
    await setDisplayName(name.trim());
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="What's your name?"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">
          Shown to others editing this board.
        </p>
        <Input
          autoFocus
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) submit();
          }}
        />
        <Button onClick={submit} disabled={!name.trim()}>
          Join board
        </Button>
      </div>
    </Dialog>
  );
}
