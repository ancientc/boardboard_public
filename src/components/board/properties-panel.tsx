"use client";

import { useBoardStore } from "@/stores/board-store";
import { useUiStore } from "@/stores/ui-store";
import { useBoardSync } from "./board-sync-provider";
import { OBJECT_TYPES, TEXT_FONT_SIZES } from "@/shared/object-types";
import type { StickyNoteData, TextData } from "@/shared/object-types";

const STICKY_COLORS = [
  "#FFE066",
  "#FFA94D",
  "#FF6B6B",
  "#CC5DE8",
  "#339AF0",
  "#51CF66",
  "#FFFFFF",
  "#ADB5BD",
];

const TEXT_COLORS = [
  "#1a1a1a",
  "#495057",
  "#868E96",
  "#E03131",
  "#F08C00",
  "#2F9E44",
  "#1971C2",
  "#9C36B5",
];

const FONT_SIZES = TEXT_FONT_SIZES;

export function PropertiesPanel() {
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const objects = useBoardStore((s) => s.objects);
  const setSelection = useBoardStore((s) => s.setSelection);
  const setLastUsedColor = useUiStore((s) => s.setLastUsedColor);
  const { upsertObject, removeObject } = useBoardSync();

  if (selectedIds.size === 0) return null;

  const selectedId = Array.from(selectedIds)[0];
  const obj = objects.get(selectedId);
  if (!obj) return null;

  const handleDelete = () => {
    for (const id of selectedIds) removeObject(id);
    setSelection([]);
  };

  const updateStickyColor = (data: StickyNoteData) => (color: string) => {
    upsertObject({
      ...obj,
      dataJson: JSON.stringify({ ...data, backgroundColor: color }),
      updatedAt: new Date().toISOString(),
    });
    setLastUsedColor(color);
  };

  const updateText = (data: TextData) => (patch: Partial<TextData>) => {
    upsertObject({
      ...obj,
      dataJson: JSON.stringify({ ...data, ...patch }),
      updatedAt: new Date().toISOString(),
    });
  };

  const isSticky = obj.type === OBJECT_TYPES.stickyNote;
  const isText = obj.type === OBJECT_TYPES.text;

  return (
    <aside className="absolute right-0 top-12 z-20 w-56 border-l border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700">
        {isSticky ? "Sticky Note" : isText ? "Text" : "Object"}
      </h3>

      {isSticky && (() => {
        const data: StickyNoteData = JSON.parse(obj.dataJson);
        const setColor = updateStickyColor(data);
        return (
          <div className="mt-3">
            <span className="text-xs font-medium text-gray-500">Color</span>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {STICKY_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setColor(color)}
                  className={`h-7 w-7 rounded-md border-2 transition-transform hover:scale-110 ${
                    data.backgroundColor === color
                      ? "border-indigo-500"
                      : "border-gray-200"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {isText && (() => {
        const data: TextData = JSON.parse(obj.dataJson);
        const patch = updateText(data);
        return (
          <>
            <div className="mt-3">
              <span className="text-xs font-medium text-gray-500">
                Font size
              </span>
              <select
                value={data.fontSize}
                onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <span className="text-xs font-medium text-gray-500">Color</span>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => patch({ color })}
                    className={`h-7 w-7 rounded-md border-2 transition-transform hover:scale-110 ${
                      data.color === color
                        ? "border-indigo-500"
                        : "border-gray-200"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={() =>
                  patch({
                    fontWeight: data.fontWeight === "bold" ? "normal" : "bold",
                  })
                }
                className={`w-full rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  data.fontWeight === "bold"
                    ? "bg-indigo-100 text-indigo-700"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Bold
              </button>
            </div>
          </>
        );
      })()}

      <div className="mt-4 border-t border-gray-100 pt-3">
        <button
          onClick={handleDelete}
          className="w-full rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </aside>
  );
}
