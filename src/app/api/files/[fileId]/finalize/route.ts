import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { boardObjects, files } from "@/db/schema";
import { getDbFromContext, getEnv } from "@/server/cf";
import { ensureBoardMembership } from "@/server/board-access";
import { R2_BUCKET_NAME } from "@/server/files";
import {
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
} from "@/shared/object-types";
import { fileContentUrl } from "@/shared/file-urls";
import { getOrCreateGuest } from "@/server/session";
import { verifyUploadToken } from "@/server/upload-token";
import { OBJECT_TYPES } from "@/shared/object-types";
import { finalizeUploadSchema } from "@/shared/schemas/file";
import { generateKeyBetween } from "fractional-indexing";
import type { BoardObject } from "@/shared/types";

type Params = { params: Promise<{ fileId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { fileId } = await params;
  const guest = await getOrCreateGuest();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = finalizeUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { boardId, uploadToken, x, y, width, height } = parsed.data;

  const tokenPayload = await verifyUploadToken(uploadToken, fileId);
  if (!tokenPayload || tokenPayload.boardId !== boardId) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  await ensureBoardMembership(boardId, guest.userId);

  const env = await getEnv();
  const head = await env.STORAGE.head(tokenPayload.r2Key);
  if (!head) {
    return NextResponse.json(
      { error: "Upload not found in storage" },
      { status: 400 },
    );
  }

  const db = await getDbFromContext();
  const now = new Date().toISOString();
  const publicUrl = fileContentUrl(fileId);

  const existingFile = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .get();

  if (!existingFile) {
    await db.insert(files).values({
      id: fileId,
      boardId,
      uploadedBy: guest.userId,
      originalFilename: tokenPayload.originalFilename,
      mimeType: tokenPayload.mimeType,
      sizeBytes: head.size,
      r2Bucket: R2_BUCKET_NAME,
      r2Key: tokenPayload.r2Key,
      publicUrl,
      createdAt: now,
      deletedAt: null,
    });
  }

  const zRows = await db
    .select({ zIndex: boardObjects.zIndex })
    .from(boardObjects)
    .where(
      and(eq(boardObjects.boardId, boardId), isNull(boardObjects.deletedAt)),
    )
    .all();
  const lastZ =
    zRows.length > 0
      ? zRows.map((r) => r.zIndex).sort((a, b) => a.localeCompare(b)).at(-1) ??
        null
      : null;

  const objectId = crypto.randomUUID();
  const zIndex = generateKeyBetween(lastZ, null);
  const objWidth = width ?? DEFAULT_IMAGE_WIDTH;
  const objHeight = height ?? DEFAULT_IMAGE_HEIGHT;
  const objX = x ?? 100;
  const objY = y ?? 100;

  const dataJson = JSON.stringify({
    fileId,
    alt: tokenPayload.originalFilename,
    objectFit: "contain",
  });

  const boardObject: BoardObject = {
    id: objectId,
    boardId,
    type: OBJECT_TYPES.image,
    x: objX,
    y: objY,
    width: objWidth,
    height: objHeight,
    rotation: 0,
    zIndex,
    dataJson,
    createdBy: guest.userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.insert(boardObjects).values({
    id: boardObject.id,
    boardId: boardObject.boardId,
    type: boardObject.type,
    x: boardObject.x,
    y: boardObject.y,
    width: boardObject.width,
    height: boardObject.height,
    rotation: boardObject.rotation,
    zIndex: boardObject.zIndex,
    dataJson: boardObject.dataJson,
    createdBy: boardObject.createdBy,
    createdAt: boardObject.createdAt,
    updatedAt: boardObject.updatedAt,
    deletedAt: null,
  });

  const fileRow = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .get();

  return NextResponse.json({
    file: fileRow
      ? {
          id: fileRow.id,
          boardId: fileRow.boardId,
          uploadedBy: fileRow.uploadedBy,
          originalFilename: fileRow.originalFilename,
          mimeType: fileRow.mimeType,
          sizeBytes: fileRow.sizeBytes,
          r2Bucket: fileRow.r2Bucket,
          r2Key: fileRow.r2Key,
          publicUrl: fileRow.publicUrl,
          createdAt: fileRow.createdAt,
          deletedAt: fileRow.deletedAt,
        }
      : null,
    object: boardObject,
  });
}
