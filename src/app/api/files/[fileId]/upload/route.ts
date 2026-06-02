import { NextResponse } from "next/server";
import { getEnv } from "@/server/cf";
import { MAX_FILE_BYTES } from "@/server/files";
import { getOrCreateGuest } from "@/server/session";
import { verifyUploadToken } from "@/server/upload-token";

type Params = { params: Promise<{ fileId: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { fileId } = await params;
  await getOrCreateGuest();

  const uploadToken =
    request.headers.get("X-Upload-Token") ??
    new URL(request.url).searchParams.get("token");

  if (!uploadToken) {
    return NextResponse.json({ error: "Missing upload token" }, { status: 401 });
  }

  const payload = await verifyUploadToken(uploadToken, fileId);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const contentLength = request.headers.get("Content-Length");
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10);
    if (Number.isFinite(size) && size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  if (body.byteLength > payload.sizeBytes) {
    return NextResponse.json(
      { error: "Uploaded size exceeds declared size" },
      { status: 400 },
    );
  }

  const env = await getEnv();
  await env.STORAGE.put(payload.r2Key, body, {
    httpMetadata: { contentType: payload.mimeType },
  });

  return NextResponse.json({ ok: true, fileId, r2Key: payload.r2Key });
}
