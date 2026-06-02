import { describe, expect, it } from "vitest";
import { presignRequestSchema, finalizeUploadSchema } from "./file";

describe("presignRequestSchema", () => {
  it("accepts valid presign payload", () => {
    const result = presignRequestSchema.safeParse({
      boardId: "b1",
      filename: "photo.png",
      mimeType: "image/png",
      sizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });

  it("rejects oversized files", () => {
    const result = presignRequestSchema.safeParse({
      boardId: "b1",
      filename: "big.png",
      mimeType: "image/png",
      sizeBytes: 11 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
  });
});

describe("finalizeUploadSchema", () => {
  it("requires boardId and uploadToken", () => {
    const result = finalizeUploadSchema.safeParse({
      boardId: "b1",
      uploadToken: "token",
    });
    expect(result.success).toBe(true);
  });
});
