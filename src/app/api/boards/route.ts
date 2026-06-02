import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDbFromContext } from "@/server/cf";
import { getOrCreateGuest } from "@/server/session";
import { boards, boardMembers } from "@/db/schema";

export async function GET() {
  const guest = await getOrCreateGuest();
  const db = await getDbFromContext();
  const rows = await db
    .select({
      id: boards.id,
      title: boards.title,
      updatedAt: boards.updatedAt,
    })
    .from(boards)
    .innerJoin(boardMembers, eq(boardMembers.boardId, boards.id))
    .where(eq(boardMembers.userId, guest.userId))
    .orderBy(desc(boards.updatedAt))
    .all();

  return NextResponse.json({ boards: rows });
}

export async function POST(request: Request) {
  const guest = await getOrCreateGuest();
  const body = (await request.json().catch(() => ({}))) as { title?: string };
  const title = (body.title ?? "").trim() || "Untitled board";

  const db = await getDbFromContext();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(boards).values({
    id,
    title,
    ownerUserId: guest.userId,
    accessToken: null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(boardMembers).values({
    id: crypto.randomUUID(),
    boardId: id,
    userId: guest.userId,
    role: "owner",
    joinedAt: now,
  });

  return NextResponse.json({ id, title, updatedAt: now }, { status: 201 });
}
