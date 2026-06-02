/** R2 bucket name from wrangler.toml — metadata only; bytes use STORAGE binding. */
export const R2_BUCKET_NAME = "boardboard-storage";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

export function isAllowedImageMime(mimeType: string): boolean {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}
