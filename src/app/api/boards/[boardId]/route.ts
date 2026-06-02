import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDbFromContext } from "@/server/cf";
import { ensureBoardMembership } from "@/server/board-access";
import { getOrCreateGuest } from "@/server/session";
import { boards, boardMembers, boardObjects } from "@/db/schema";

type Params = { params: Promise<{ boardId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { boardId } = await params;
  const guest = await getOrCreateGuest();
  const db = await getDbFromContext();

  const board = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .get();

  if (!board) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await ensureBoardMembership(boardId, guest.userId);

  return NextResponse.json(board);
}

export async function PATCH(request: Request, { params }: Params) {
  const { boardId } = await params;
  await getOrCreateGuest();
  const body = (await request.json().catch(() => ({}))) as { title?: string };
  const db = await getDbFromContext();

  if (typeof body.title === "string") {
    const title = body.title.trim() || "Untitled board";
    await db
      .update(boards)
      .set({ title, updatedAt: new Date().toISOString() })
      .where(eq(boards.id, boardId));
  }

  const board = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .get();

  return NextResponse.json(board);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { boardId } = await params;
  await getOrCreateGuest();
  const db = await getDbFromContext();

  await db.delete(boardObjects).where(eq(boardObjects.boardId, boardId));
  await db.delete(boardMembers).where(eq(boardMembers.boardId, boardId));
  await db.delete(boards).where(eq(boards.id, boardId));

  return NextResponse.json({ ok: true });
}
