import { describe, expect, it } from "vitest";
import { isAllowedImageMime, MAX_FILE_BYTES } from "./files";

describe("isAllowedImageMime", () => {
  it("allows common image types", () => {
    expect(isAllowedImageMime("image/png")).toBe(true);
    expect(isAllowedImageMime("image/jpeg")).toBe(true);
    expect(isAllowedImageMime("image/webp")).toBe(true);
  });

  it("rejects non-images", () => {
    expect(isAllowedImageMime("application/pdf")).toBe(false);
    expect(isAllowedImageMime("text/plain")).toBe(false);
  });
});

describe("MAX_FILE_BYTES", () => {
  it("caps at 10 MB", () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
});
