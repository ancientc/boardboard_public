"use client";

import { useBoardStore } from "@/stores/board-store";
import { Avatar } from "@/components/ui/avatar";

export function ParticipantList() {
  const presence = useBoardStore((s) => s.presence);
  const users = Array.from(presence.values());

  if (users.length === 0) return null;

  return (
    <div className="absolute right-4 top-16 z-20 flex gap-[-0.5rem]">
      {users.map((u) => (
        <Avatar key={u.userId} name={u.displayName} color={u.color} />
      ))}
    </div>
  );
}
