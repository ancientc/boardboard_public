/**
 * Generates the canonical R2 key for a board file upload.
 */
export function buildR2Key(
  boardId: string,
  fileId: string,
  safeFilename: string,
): string {
  return `boards/${boardId}/files/${fileId}/${safeFilename}`;
}

/**
 * Sanitizes a user-supplied filename for use as an R2 key segment.
 */
export function sanitizeFilename(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}
