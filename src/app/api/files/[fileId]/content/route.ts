import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { files } from "@/db/schema";
import { getDbFromContext, getEnv } from "@/server/cf";
import { ensureBoardMembership } from "@/server/board-access";
import { getOrCreateGuest } from "@/server/session";

type Params = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { fileId } = await params;
  const guest = await getOrCreateGuest();
  const db = await getDbFromContext();

  const file = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .get();

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await ensureBoardMembership(file.boardId, guest.userId);

  const env = await getEnv();
  const object = await env.STORAGE.get(file.r2Key);
  if (!object) {
    return NextResponse.json({ error: "File missing from storage" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? file.mimeType,
  );
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(object.body, { status: 200, headers });
}
