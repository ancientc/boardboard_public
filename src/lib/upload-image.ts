import type { BoardObject } from "@/shared/types";

export interface UploadImageOptions {
  boardId: string;
  file: File;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface UploadImageResult {
  file: Record<string, unknown>;
  object: BoardObject;
}

export class UploadImageError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UploadImageError";
  }
}

function loadImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 480;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      resolve({
        width: Math.max(80, width),
        height: Math.max(80, height),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

/**
 * Presign → PUT upload → finalize. Returns the board object to sync.
 */
export async function uploadImageToBoard(
  options: UploadImageOptions,
): Promise<UploadImageResult> {
  const { boardId, file } = options;

  let width = options.width;
  let height = options.height;
  if (width == null || height == null) {
    try {
      const dims = await loadImageDimensions(file);
      width = width ?? dims.width;
      height = height ?? dims.height;
    } catch {
      width = width ?? 320;
      height = height ?? 240;
    }
  }

  const presignRes = await fetch("/api/files/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      boardId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    }),
  });

  if (!presignRes.ok) {
    const err = (await presignRes.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new UploadImageError(
      err.error ?? `Presign failed (${presignRes.status})`,
      presignRes.status,
    );
  }

  const presign = (await presignRes.json()) as {
    fileId: string;
    uploadUrl: string;
    uploadToken: string;
    headers: { "Content-Type": string };
  };

  const uploadRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": presign.headers["Content-Type"],
      "X-Upload-Token": presign.uploadToken,
    },
    body: file,
  });

  if (!uploadRes.ok) {
    const err = (await uploadRes.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new UploadImageError(
      err.error ?? `Upload failed (${uploadRes.status})`,
      uploadRes.status,
    );
  }

  const finalizeRes = await fetch(`/api/files/${presign.fileId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      boardId,
      uploadToken: presign.uploadToken,
      x: options.x,
      y: options.y,
      width,
      height,
    }),
  });

  if (!finalizeRes.ok) {
    const err = (await finalizeRes.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new UploadImageError(
      err.error ?? `Finalize failed (${finalizeRes.status})`,
      finalizeRes.status,
    );
  }

  return (await finalizeRes.json()) as UploadImageResult;
}
