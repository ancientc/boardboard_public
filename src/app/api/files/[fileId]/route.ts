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

  return NextResponse.json({
    file: {
      id: file.id,
      boardId: file.boardId,
      uploadedBy: file.uploadedBy,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      r2Bucket: file.r2Bucket,
      r2Key: file.r2Key,
      publicUrl: file.publicUrl,
      createdAt: file.createdAt,
      deletedAt: file.deletedAt,
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
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

  const now = new Date().toISOString();
  await db
    .update(files)
    .set({ deletedAt: now })
    .where(eq(files.id, fileId));

  try {
    const env = await getEnv();
    await env.STORAGE.delete(file.r2Key);
  } catch {
    // Soft-delete metadata even if R2 cleanup fails.
  }

  return NextResponse.json({ ok: true });
}
