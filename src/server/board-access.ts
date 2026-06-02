import { and, eq } from "drizzle-orm";
import { boardMembers } from "@/db/schema";
import { getDbFromContext } from "./cf";

/** Anyone with the board link becomes an editor (anonymous collaboration). */
export async function ensureBoardMembership(
  boardId: string,
  userId: string,
): Promise<void> {
  const db = await getDbFromContext();
  const existing = await db
    .select({ id: boardMembers.id })
    .from(boardMembers)
    .where(
      and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)),
    )
    .get();
  if (existing) return;
  await db.insert(boardMembers).values({
    id: crypto.randomUUID(),
    boardId,
    userId,
    role: "editor",
    joinedAt: new Date().toISOString(),
  });
}
