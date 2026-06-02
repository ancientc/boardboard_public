import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDbFromContext } from "@/server/cf";
import { getOrCreateGuest } from "@/server/session";
import { boardObjects } from "@/db/schema";

type Params = { params: Promise<{ boardId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { boardId } = await params;
  await getOrCreateGuest();
  const db = await getDbFromContext();

  const rows = await db
    .select()
    .from(boardObjects)
    .where(
      and(
        eq(boardObjects.boardId, boardId),
        isNull(boardObjects.deletedAt),
      ),
    )
    .all();

  return NextResponse.json({ objects: rows });
}
