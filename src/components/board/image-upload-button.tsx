"use client";

import { useRef, useState } from "react";
import { useBoardStore } from "@/stores/board-store";
import { useBoardSync } from "@/components/board/board-sync-provider";
import { uploadImageToBoard, UploadImageError } from "@/lib/upload-image";

function ImageIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

export function ImageUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { boardId, upsertObject } = useBoardSync();
  const camera = useBoardStore((s) => s.camera);

  const handlePick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !boardId) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const centerX = (window.innerWidth / 2 - camera.x) / camera.zoom;
      const centerY = (window.innerHeight / 2 - camera.y) / camera.zoom;

      const { object } = await uploadImageToBoard({
        boardId,
        file,
        x: centerX - 160,
        y: centerY - 120,
      });

      upsertObject(object);
    } catch (err) {
      const message =
        err instanceof UploadImageError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Upload failed";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const title = error ?? (uploading ? "Uploading…" : "Upload image");

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={handlePick}
        disabled={uploading}
        title={title}
        className={`flex items-center justify-center rounded-md p-2 transition-colors text-gray-600 hover:bg-gray-100 disabled:opacity-50 ${
          error ? "text-red-600" : ""
        }`}
      >
        <ImageIcon />
      </button>
    </>
  );
}
