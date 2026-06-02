import { describe, expect, it } from "vitest";
import { buildR2Key, sanitizeFilename } from "./r2";

describe("buildR2Key", () => {
  it("uses canonical board file path", () => {
    expect(buildR2Key("board-1", "file-1", "photo.png")).toBe(
      "boards/board-1/files/file-1/photo.png",
    );
  });
});

describe("sanitizeFilename", () => {
  it("replaces unsafe characters", () => {
    expect(sanitizeFilename("my photo (1).png")).toBe("my_photo__1_.png");
  });

  it("truncates long names", () => {
    const long = "a".repeat(300);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(200);
  });
});
