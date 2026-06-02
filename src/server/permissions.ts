import { eq, and } from "drizzle-orm";
import { boardMembers } from "@/db/schema";
import type { Db } from "@/db/client";

export type BoardRole = "owner" | "editor" | "viewer";

const ROLE_HIERARCHY: Record<BoardRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

export async function getUserRole(
  db: Db,
  boardId: string,
  userId: string,
): Promise<BoardRole | null> {
  const row = await db
    .select({ role: boardMembers.role })
    .from(boardMembers)
    .where(
      and(
        eq(boardMembers.boardId, boardId),
        eq(boardMembers.userId, userId),
      ),
    )
    .get();

  return (row?.role as BoardRole) ?? null;
}

export function hasPermission(
  userRole: BoardRole | null,
  requiredRole: BoardRole,
): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
