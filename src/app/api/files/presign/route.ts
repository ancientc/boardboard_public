import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { boards } from "@/db/schema";
import { getDbFromContext } from "@/server/cf";
import { ensureBoardMembership } from "@/server/board-access";
import { isAllowedImageMime } from "@/server/files";
import { buildR2Key, sanitizeFilename } from "@/server/r2";
import { getOrCreateGuest } from "@/server/session";
import { createUploadToken } from "@/server/upload-token";
import { presignRequestSchema } from "@/shared/schemas/file";

export async function POST(request: Request) {
  const guest = await getOrCreateGuest();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = presignRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { boardId, filename, mimeType, sizeBytes } = parsed.data;

  if (!isAllowedImageMime(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported image type" },
      { status: 400 },
    );
  }

  const db = await getDbFromContext();
  const board = await db
    .select({ id: boards.id })
    .from(boards)
    .where(eq(boards.id, boardId))
    .get();

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  await ensureBoardMembership(boardId, guest.userId);

  const fileId = crypto.randomUUID();
  const safeFilename = sanitizeFilename(filename);
  const r2Key = buildR2Key(boardId, fileId, safeFilename);
  const uploadToken = await createUploadToken({
    fileId,
    boardId,
    r2Key,
    mimeType,
    sizeBytes,
    originalFilename: filename,
  });

  const uploadUrl = `/api/files/${fileId}/upload`;

  return NextResponse.json({
    fileId,
    r2Key,
    uploadUrl,
    uploadToken,
    headers: {
      "Content-Type": mimeType,
    },
  });
}
