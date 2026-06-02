import type { PresenceInfo } from "@/shared/types";

/**
 * Local presence state for all users on the board.
 */
export class PresenceManager {
  private peers: Map<string, PresenceInfo> = new Map();

  upsert(userId: string, info: Partial<PresenceInfo>) {
    const existing = this.peers.get(userId);
    this.peers.set(userId, {
      userId,
      displayName: info.displayName ?? existing?.displayName ?? "Anonymous",
      cursor: info.cursor ?? existing?.cursor ?? null,
      color: info.color ?? existing?.color ?? "#888",
    });
  }

  remove(userId: string) {
    this.peers.delete(userId);
  }

  getAll(): PresenceInfo[] {
    return Array.from(this.peers.values());
  }

  get(userId: string): PresenceInfo | undefined {
    return this.peers.get(userId);
  }
}
