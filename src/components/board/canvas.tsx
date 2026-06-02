"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Group, Rect, Text, Circle, Transformer } from "react-konva";
import type Konva from "konva";
import { useBoardStore } from "@/stores/board-store";
import { useUiStore } from "@/stores/ui-store";
import { useBoardSync } from "./board-sync-provider";
import {
  OBJECT_TYPES,
  DEFAULT_TEXT_FONT_SIZE,
  snapFontSize,
} from "@/shared/object-types";
import type { BoardObject } from "@/shared/types";
import type { StickyNoteData, TextData } from "@/shared/object-types";
import { generateKeyBetween } from "fractional-indexing";
import { CanvasImageObject } from "@/components/board/canvas-image-object";

const STICKY_W = 200;
const STICKY_H = 200;
const TEXT_W = 240;
const TEXT_H = 60;
const MIN_DRAW = 20;

const STICKY_PADDING = 8;
const STICKY_FONT_MIN = 10;
// Font upper bound is proportional to the sticky's inner size so that
// resizing the sticky scales the text with it.
const STICKY_FONT_MAX_RATIO = 1 / 3;
const STICKY_LINE_HEIGHT = 1.2;
const STICKY_FONT_FAMILY = "Arial";

let _measureCanvas: HTMLCanvasElement | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!_measureCanvas) _measureCanvas = document.createElement("canvas");
  return _measureCanvas.getContext("2d");
}

function countWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): number {
  const paragraphs = text.split("\n");
  let total = 0;
  for (const para of paragraphs) {
    if (para === "") {
      total += 1;
      continue;
    }
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const w = ctx.measureText(test).width;
      if (w > maxWidth && line) {
        total += 1;
        line = word;
      } else {
        line = test;
      }
    }
    if (line !== "") total += 1;
  }
  return total;
}

// Binary-searches the largest font size that lets `text` fit inside the given
// inner box. Shared by sticky notes and text elements so both resize the same
// way; `fontStyle` lets bold text measure correctly.
function computeFitLayout(
  text: string,
  innerWidth: number,
  innerHeight: number,
  options?: { fontFamily?: string; fontStyle?: string; lineHeight?: number },
): { fontSize: number; lines: number } {
  const fontFamily = options?.fontFamily ?? STICKY_FONT_FAMILY;
  const fontStyle = options?.fontStyle ?? "";
  const lineHeight = options?.lineHeight ?? STICKY_LINE_HEIGHT;
  const fontPrefix = fontStyle ? `${fontStyle} ` : "";

  if (innerWidth <= 0 || innerHeight <= 0) {
    return { fontSize: STICKY_FONT_MIN, lines: 1 };
  }
  const maxFont = Math.max(
    STICKY_FONT_MIN,
    Math.floor(Math.min(innerWidth, innerHeight) * STICKY_FONT_MAX_RATIO),
  );
  if (!text) return { fontSize: maxFont, lines: 1 };
  const ctx = getMeasureCtx();
  if (!ctx) return { fontSize: maxFont, lines: 1 };

  let low = STICKY_FONT_MIN;
  let high = maxFont;
  while (high - low > 0.5) {
    const mid = (low + high) / 2;
    ctx.font = `${fontPrefix}${mid}px ${fontFamily}`;
    const lines = countWrappedLines(ctx, text, innerWidth);
    if (lines * mid * lineHeight <= innerHeight) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const fontSize = Math.max(STICKY_FONT_MIN, Math.floor(low));
  ctx.font = `${fontPrefix}${fontSize}px ${fontFamily}`;
  const lines = Math.max(1, countWrappedLines(ctx, text, innerWidth));
  return { fontSize, lines };
}

function computeStickyLayout(
  text: string,
  innerWidth: number,
  innerHeight: number,
): { fontSize: number; lines: number } {
  return computeFitLayout(text, innerWidth, innerHeight);
}

// Largest box width a pasted text element may auto-size to before wrapping.
const TEXT_PASTE_MAX_W = 600;

// Sizes a text box so pasted content fits at the given font size: wide enough
// for the longest line (capped) and tall enough for the wrapped line count.
function measureTextBox(
  text: string,
  fontSize: number,
): { width: number; height: number } {
  const ctx = getMeasureCtx();
  if (!ctx) return { width: TEXT_W, height: TEXT_H };
  ctx.font = `${fontSize}px ${STICKY_FONT_FAMILY}`;
  let naturalW = 0;
  for (const line of text.split("\n")) {
    naturalW = Math.max(naturalW, ctx.measureText(line).width);
  }
  const width = Math.min(
    TEXT_PASTE_MAX_W,
    Math.max(TEXT_W, Math.ceil(naturalW) + 4),
  );
  const lines = Math.max(1, countWrappedLines(ctx, text, width));
  const height = Math.max(
    TEXT_H,
    Math.ceil(lines * fontSize * STICKY_LINE_HEIGHT) + 4,
  );
  return { width, height };
}

interface EditingState {
  objectId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editingText, setEditingText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const objects = useBoardStore((s) => s.objects);
  const camera = useBoardStore((s) => s.camera);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const presence = useBoardStore((s) => s.presence);
  const setCamera = useBoardStore((s) => s.setCamera);
  const setSelection = useBoardStore((s) => s.setSelection);

  const {
    boardId,
    guest,
    upsertObject,
    removeObject,
    sendCursor,
  } = useBoardSync();

  const currentTool = useUiStore((s) => s.currentTool);
  const lastUsedColor = useUiStore((s) => s.lastUsedColor);
  const setTool = useUiStore((s) => s.setTool);

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const camStart = useRef({ x: 0, y: 0 });

  const isDrawing = useRef(false);
  const drawingTool = useRef<"sticky_note" | "text" | null>(null);
  const drawOrigin = useRef({ x: 0, y: 0 });
  const [drawPreview, setDrawPreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Last known pointer position (stage-local) and whether it is over the
  // canvas, used to place pasted text under the cursor.
  const pointerStage = useRef<{ x: number; y: number } | null>(null);
  const overCanvas = useRef(false);

  // Box size and font size captured when a text corner-resize begins, so the
  // font can scale proportionally to the box rather than refit to it.
  const textResizeStart = useRef<{
    w: number;
    h: number;
    fontSize: number;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = Array.from(objects.values())
    .filter((o) => !o.deletedAt)
    .sort((a, b) => a.zIndex.localeCompare(b.zIndex));

  const nextZ = useCallback(() => {
    const last =
      sorted.length > 0 ? sorted[sorted.length - 1].zIndex : null;
    return generateKeyBetween(last, null);
  }, [sorted]);

  const toPage = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - camera.x) / camera.zoom,
      y: (sy - camera.y) / camera.zoom,
    }),
    [camera],
  );

  const createStickyAt = useCallback(
    (rx: number, ry: number, rw: number, rh: number, openEditor: boolean) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const obj: BoardObject = {
        id,
        boardId,
        type: OBJECT_TYPES.stickyNote,
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        rotation: 0,
        zIndex: nextZ(),
        dataJson: JSON.stringify({
          text: "",
          backgroundColor: lastUsedColor,
          fontSize: 16,
        } satisfies StickyNoteData),
        createdBy: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      upsertObject(obj);
      setSelection([id]);
      setTool("select");

      if (openEditor) {
        setEditingText("");
        setEditing({
          objectId: id,
          x: rx * camera.zoom + camera.x,
          y: ry * camera.zoom + camera.y,
          width: rw * camera.zoom,
          height: rh * camera.zoom,
        });
      }
    },
    [boardId, nextZ, lastUsedColor, upsertObject, setSelection, setTool, camera],
  );

  const createTextAt = useCallback(
    (rx: number, ry: number, rw: number, rh: number, openEditor: boolean) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const obj: BoardObject = {
        id,
        boardId,
        type: OBJECT_TYPES.text,
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        rotation: 0,
        zIndex: nextZ(),
        dataJson: JSON.stringify({
          text: "",
          fontSize: DEFAULT_TEXT_FONT_SIZE,
          color: "#1a1a1a",
          fontWeight: "normal",
        } satisfies TextData),
        createdBy: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      upsertObject(obj);
      setSelection([id]);
      setTool("select");

      if (openEditor) {
        setEditingText("");
        setEditing({
          objectId: id,
          x: rx * camera.zoom + camera.x,
          y: ry * camera.zoom + camera.y,
          width: rw * camera.zoom,
          height: rh * camera.zoom,
        });
      }
    },
    [boardId, nextZ, upsertObject, setSelection, setTool, camera],
  );

  // Creates a text object pre-filled with `text`, sized to fit it and centered
  // on the given page coordinate. Used by clipboard paste.
  const createTextWith = useCallback(
    (text: string, centerX: number, centerY: number) => {
      const fontSize = DEFAULT_TEXT_FONT_SIZE;
      const { width: boxW, height: boxH } = measureTextBox(text, fontSize);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const obj: BoardObject = {
        id,
        boardId,
        type: OBJECT_TYPES.text,
        x: centerX - boxW / 2,
        y: centerY - boxH / 2,
        width: boxW,
        height: boxH,
        rotation: 0,
        zIndex: nextZ(),
        dataJson: JSON.stringify({
          text,
          fontSize,
          color: "#1a1a1a",
          fontWeight: "normal",
        } satisfies TextData),
        createdBy: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      upsertObject(obj);
      setSelection([id]);
      setTool("select");
    },
    [boardId, nextZ, upsertObject, setSelection, setTool],
  );

  /* ---- Wheel zoom ---- */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;
      const oldZ = camera.zoom;
      const factor = 1.08;
      const newZ =
        e.evt.deltaY < 0
          ? Math.min(oldZ * factor, 5)
          : Math.max(oldZ / factor, 0.1);
      const mp = {
        x: (pointer.x - camera.x) / oldZ,
        y: (pointer.y - camera.y) / oldZ,
      };
      setCamera({
        zoom: newZ,
        x: pointer.x - mp.x * newZ,
        y: pointer.y - mp.y * newZ,
      });
    },
    [camera, setCamera],
  );

  /* ---- Mouse down ---- */
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (editing) return;

      if (e.evt.button === 1) {
        isPanning.current = true;
        panStart.current = { x: e.evt.clientX, y: e.evt.clientY };
        camStart.current = { x: camera.x, y: camera.y };
        e.evt.preventDefault();
        return;
      }

      if (e.evt.button !== 0) return;

      const onEmpty = e.target === stageRef.current;

      if (currentTool === "select" && onEmpty) {
        setSelection([]);
        isPanning.current = true;
        panStart.current = { x: e.evt.clientX, y: e.evt.clientY };
        camStart.current = { x: camera.x, y: camera.y };
      } else if (
        (currentTool === "sticky_note" || currentTool === "text") &&
        onEmpty
      ) {
        const pointer = stageRef.current?.getPointerPosition();
        if (pointer) {
          const p = toPage(pointer.x, pointer.y);
          isDrawing.current = true;
          drawingTool.current = currentTool;
          drawOrigin.current = p;
          setDrawPreview({ x: p.x, y: p.y, width: 0, height: 0 });
        }
      }
    },
    [editing, camera, currentTool, setSelection, toPage],
  );

  /* ---- Mouse move / up (pan + draw) ---- */
  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isDrawing.current) {
        const pointer = stageRef.current?.getPointerPosition();
        if (pointer) {
          const p = toPage(pointer.x, pointer.y);
          const ox = drawOrigin.current.x;
          const oy = drawOrigin.current.y;
          setDrawPreview({
            x: Math.min(ox, p.x),
            y: Math.min(oy, p.y),
            width: Math.abs(p.x - ox),
            height: Math.abs(p.y - oy),
          });
        }
        return;
      }
      if (!isPanning.current) return;
      setCamera({
        x: camStart.current.x + (e.evt.clientX - panStart.current.x),
        y: camStart.current.y + (e.evt.clientY - panStart.current.y),
      });
    },
    [setCamera, toPage],
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing.current) {
      isDrawing.current = false;
      const tool = drawingTool.current;
      drawingTool.current = null;
      const pointer = stageRef.current?.getPointerPosition();
      const origin = drawOrigin.current;
      setDrawPreview(null);

      if (pointer && tool) {
        const p = toPage(pointer.x, pointer.y);
        const w = Math.abs(p.x - origin.x);
        const h = Math.abs(p.y - origin.y);

        const create = tool === "text" ? createTextAt : createStickyAt;
        const defW = tool === "text" ? TEXT_W : STICKY_W;
        const defH = tool === "text" ? TEXT_H : STICKY_H;

        if (w > MIN_DRAW && h > MIN_DRAW) {
          create(
            Math.min(origin.x, p.x),
            Math.min(origin.y, p.y),
            w,
            h,
            tool === "sticky_note",
          );
        } else {
          create(
            origin.x - defW / 2,
            origin.y - defH / 2,
            defW,
            defH,
            true,
          );
        }
      }
      return;
    }
    isPanning.current = false;
  }, [toPage, createStickyAt, createTextAt]);

  /* ---- Object interaction ---- */
  const handleObjClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      if (currentTool === "select") setSelection([id]);
    },
    [currentTool, setSelection],
  );

  const handleDragEnd = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const obj = objects.get(id);
      if (!obj) return;
      upsertObject({
        ...obj,
        x: e.target.x(),
        y: e.target.y(),
        updatedAt: new Date().toISOString(),
      });
    },
    [objects, upsertObject],
  );

  const handleImageResizeEnd = useCallback(
    (
      id: string,
      geometry: { x: number; y: number; width: number; height: number },
    ) => {
      const obj = objects.get(id);
      if (!obj) return;
      upsertObject({
        ...obj,
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        updatedAt: new Date().toISOString(),
      });
    },
    [objects, upsertObject],
  );

  const handleDblClick = useCallback(
    (id: string) => {
      const obj = objects.get(id);
      if (!obj) return;
      if (
        obj.type !== OBJECT_TYPES.stickyNote &&
        obj.type !== OBJECT_TYPES.text
      )
        return;
      const defW = obj.type === OBJECT_TYPES.text ? TEXT_W : STICKY_W;
      const defH = obj.type === OBJECT_TYPES.text ? TEXT_H : STICKY_H;
      const w = obj.width ?? defW;
      const h = obj.height ?? defH;
      setSelection([id]);
      const data = JSON.parse(obj.dataJson) as { text?: string };
      setEditingText(data.text ?? "");
      setEditing({
        objectId: id,
        x: obj.x * camera.zoom + camera.x,
        y: obj.y * camera.zoom + camera.y,
        width: w * camera.zoom,
        height: h * camera.zoom,
      });
    },
    [objects, camera, setSelection],
  );

  /* ---- Text editing ---- */
  const finishEditing = useCallback(() => {
    if (!editing) return;
    const obj = objects.get(editing.objectId);
    if (!obj) {
      setEditing(null);
      return;
    }
    const data = JSON.parse(obj.dataJson) as { text: string };
    data.text = editingText;
    upsertObject({
      ...obj,
      dataJson: JSON.stringify(data),
      updatedAt: new Date().toISOString(),
    });
    setEditing(null);
  }, [editing, editingText, objects, upsertObject]);

  useEffect(() => {
    if (!editing) return;
    const obj = objects.get(editing.objectId);
    if (obj) {
      const d = JSON.parse(obj.dataJson) as { text?: string };
      setEditingText(d.text ?? "");
    }
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    }
    // We only want to init when entering an editing session, not on every
    // keystroke that changes `objects`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /* ---- Transformer sync ---- */
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    if (editing) {
      tr.nodes([]);
    } else {
      const nodes = Array.from(selectedIds)
        .map((id) => stage.findOne("#" + id))
        .filter((n): n is Konva.Node => n !== undefined);
      tr.nodes(nodes);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedIds, editing]);

  // Konva's Transformer only listens for attribute changes on the attached
  // Group node; our shapes' width/height live on the child Rect, so the
  // Transformer's cached bounding box doesn't refresh after a resize commit.
  // Force a re-measure whenever an object changes.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr || tr.nodes().length === 0) return;
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  }, [objects]);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editing) {
        if (e.key === "Escape") finishEditing();
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (selectedIds.size > 0) {
          const newIds: string[] = [];
          for (const id of selectedIds) {
            const src = objects.get(id);
            if (!src) continue;
            const newId = crypto.randomUUID();
            const now = new Date().toISOString();
            upsertObject({
              ...src,
              id: newId,
              x: src.x + 20,
              y: src.y + 20,
              zIndex: nextZ(),
              createdAt: now,
              updatedAt: now,
            });
            newIds.push(newId);
          }
          setSelection(newIds);
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size > 0) {
          for (const id of selectedIds) removeObject(id);
          setSelection([]);
        }
      }
      if (e.key === "Escape") {
        setSelection([]);
        setTool("select");
      }
      if (e.key === "v" || e.key === "1") setTool("select");
      if (e.key === "s" || e.key === "2") setTool("sticky_note");
      if (e.key === "t" || e.key === "3") setTool("text");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing, selectedIds, objects, removeObject, upsertObject, nextZ, setSelection, setTool, finishEditing]);

  /* ---- Paste text -> new text box ---- */
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Let an active text field handle its own paste.
      if (editing) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text.trim()) return;

      e.preventDefault();

      // Cursor over the canvas -> drop it there; otherwise screen center.
      const stagePoint =
        overCanvas.current && pointerStage.current
          ? pointerStage.current
          : { x: size.width / 2, y: size.height / 2 };
      const p = toPage(stagePoint.x, stagePoint.y);
      createTextWith(text, p.x, p.y);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [editing, size, toPage, createTextWith]);

  const cursor =
    currentTool === "sticky_note" || currentTool === "text"
      ? "crosshair"
      : "default";

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ cursor }}
      onMouseMove={(e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        pointerStage.current = { x: sx, y: sy };
        overCanvas.current = true;
        const p = toPage(sx, sy);
        sendCursor(p.x, p.y);
      }}
      onMouseEnter={() => {
        overCanvas.current = true;
      }}
      onMouseLeave={() => {
        overCanvas.current = false;
      }}
    >
      {size.width > 1 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.evt.preventDefault()}
        >
          <Layer
            x={camera.x}
            y={camera.y}
            scaleX={camera.zoom}
            scaleY={camera.zoom}
          >
            {sorted.map((obj) => {
              if (obj.type === OBJECT_TYPES.stickyNote) {
                const d: StickyNoteData = JSON.parse(obj.dataJson);
                const w = obj.width ?? STICKY_W;
                const h = obj.height ?? STICKY_H;

                return (
                  <Group
                    key={obj.id}
                    id={obj.id}
                    x={obj.x}
                    y={obj.y}
                    rotation={obj.rotation}
                    draggable={currentTool === "select"}
                    onClick={(e) => handleObjClick(obj.id, e)}
                    onTap={(e) => handleObjClick(obj.id, e)}
                    onDragStart={(e) => {
                      e.cancelBubble = true;
                      if (!selectedIds.has(obj.id)) setSelection([obj.id]);
                    }}
                    onDragEnd={(e) => handleDragEnd(obj.id, e)}
                    onDblClick={() => handleDblClick(obj.id)}
                    onDblTap={() => handleDblClick(obj.id)}
                    onMouseEnter={() => {
                      if (currentTool === "select" && stageRef.current) {
                        stageRef.current.container().style.cursor = "move";
                      }
                    }}
                    onMouseLeave={() => {
                      if (stageRef.current) {
                        stageRef.current.container().style.cursor = cursor;
                      }
                    }}
                    onTransform={(e) => {
                      const node = e.target;
                      const sx = node.scaleX();
                      const sy = node.scaleY();
                      if (sx === 1 && sy === 1) return;
                      const [bgRect, textNode] =
                        (node as unknown as Konva.Group).getChildren() as unknown as [
                          Konva.Rect,
                          Konva.Text,
                        ];
                      if (!bgRect || !textNode) return;
                      const newW = Math.max(
                        MIN_DRAW,
                        bgRect.width() * sx,
                      );
                      const newH = Math.max(
                        MIN_DRAW,
                        bgRect.height() * sy,
                      );
                      bgRect.width(newW);
                      bgRect.height(newH);
                      const innerW = newW - STICKY_PADDING * 2;
                      const innerH = newH - STICKY_PADDING * 2;
                      textNode.width(innerW);
                      textNode.height(innerH);
                      textNode.fontSize(
                        computeStickyLayout(d.text, innerW, innerH)
                          .fontSize,
                      );
                      node.scaleX(1);
                      node.scaleY(1);
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const bgRect = (node as unknown as Konva.Group).getChildren()[0] as unknown as
                        | Konva.Rect
                        | undefined;
                      node.scaleX(1);
                      node.scaleY(1);
                      upsertObject({
                        ...obj,
                        x: node.x(),
                        y: node.y(),
                        width: Math.round(bgRect?.width() ?? w),
                        height: Math.round(bgRect?.height() ?? h),
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                  >
                    <Rect
                      width={w}
                      height={h}
                      fill={d.backgroundColor}
                      cornerRadius={4}
                      shadowColor="rgba(0,0,0,0.12)"
                      shadowBlur={8}
                      shadowOffsetY={2}
                    />
                    <Text
                      text={d.text}
                      width={w - STICKY_PADDING * 2}
                      height={h - STICKY_PADDING * 2}
                      x={STICKY_PADDING}
                      y={STICKY_PADDING}
                      fontFamily={STICKY_FONT_FAMILY}
                      lineHeight={STICKY_LINE_HEIGHT}
                      fontSize={
                        computeStickyLayout(
                          d.text,
                          w - STICKY_PADDING * 2,
                          h - STICKY_PADDING * 2,
                        ).fontSize
                      }
                      align="center"
                      verticalAlign="middle"
                      fill="#1a1a1a"
                      wrap="word"
                      listening={false}
                    />
                  </Group>
                );
              }

              if (obj.type === OBJECT_TYPES.text) {
                const d: TextData = JSON.parse(obj.dataJson);
                const w = obj.width ?? TEXT_W;
                const h = obj.height ?? TEXT_H;

                return (
                  <Group
                    key={obj.id}
                    id={obj.id}
                    x={obj.x}
                    y={obj.y}
                    rotation={obj.rotation}
                    draggable={currentTool === "select"}
                    onClick={(e) => handleObjClick(obj.id, e)}
                    onTap={(e) => handleObjClick(obj.id, e)}
                    onDragStart={(e) => {
                      e.cancelBubble = true;
                      if (!selectedIds.has(obj.id)) setSelection([obj.id]);
                    }}
                    onDragEnd={(e) => handleDragEnd(obj.id, e)}
                    onDblClick={() => handleDblClick(obj.id)}
                    onDblTap={() => handleDblClick(obj.id)}
                    onMouseEnter={() => {
                      if (currentTool === "select" && stageRef.current) {
                        stageRef.current.container().style.cursor = "move";
                      }
                    }}
                    onMouseLeave={() => {
                      if (stageRef.current) {
                        stageRef.current.container().style.cursor = cursor;
                      }
                    }}
                    onTransformStart={(e) => {
                      const node = e.target;
                      const [bgRect, textNode] =
                        (node as unknown as Konva.Group).getChildren() as unknown as [
                          Konva.Rect | undefined,
                          Konva.Text | undefined,
                        ];
                      textResizeStart.current = {
                        w: bgRect?.width() ?? w,
                        h: bgRect?.height() ?? h,
                        fontSize: textNode?.fontSize() ?? d.fontSize,
                      };
                    }}
                    onTransform={(e) => {
                      const node = e.target;
                      const sx = node.scaleX();
                      const sy = node.scaleY();
                      if (sx === 1 && sy === 1) return;
                      const [bgRect, textNode] =
                        (node as unknown as Konva.Group).getChildren() as unknown as [
                          Konva.Rect,
                          Konva.Text,
                        ];
                      if (!bgRect || !textNode) return;
                      const newW = Math.max(
                        MIN_DRAW,
                        bgRect.width() * sx,
                      );
                      const newH = Math.max(
                        MIN_DRAW,
                        bgRect.height() * sy,
                      );
                      bgRect.width(newW);
                      bgRect.height(newH);
                      textNode.width(newW);
                      textNode.height(newH);
                      // Corner handles (top-left/top-right/bottom-left/
                      // bottom-right) scale the font proportionally to how much
                      // the box grew (relative to the size when the resize
                      // started), then snap it to the font-size scale. Side
                      // handles (top-center/bottom-center/middle-left/
                      // middle-right) keep the font and only reflow the box.
                      const anchor = trRef.current?.getActiveAnchor() ?? "";
                      const isCorner =
                        anchor !== "" &&
                        !anchor.includes("center") &&
                        !anchor.includes("middle");
                      if (isCorner) {
                        const start = textResizeStart.current;
                        const baseW = start?.w ?? newW;
                        const baseH = start?.h ?? newH;
                        const baseFont = start?.fontSize ?? d.fontSize;
                        const factor = Math.sqrt(
                          (newW / baseW) * (newH / baseH),
                        );
                        textNode.fontSize(snapFontSize(baseFont * factor));
                      }
                      node.scaleX(1);
                      node.scaleY(1);
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const [bgRect, textNode] =
                        (node as unknown as Konva.Group).getChildren() as unknown as [
                          Konva.Rect | undefined,
                          Konva.Text | undefined,
                        ];
                      node.scaleX(1);
                      node.scaleY(1);
                      textResizeStart.current = null;
                      const nextData: TextData = {
                        ...d,
                        fontSize: Math.round(textNode?.fontSize() ?? d.fontSize),
                      };
                      upsertObject({
                        ...obj,
                        x: node.x(),
                        y: node.y(),
                        width: Math.round(bgRect?.width() ?? w),
                        height: Math.round(bgRect?.height() ?? h),
                        dataJson: JSON.stringify(nextData),
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                  >
                    <Rect
                      width={w}
                      height={h}
                      fill="rgba(0,0,0,0)"
                    />
                    <Text
                      text={d.text || "Text"}
                      width={w}
                      height={h}
                      fontFamily={STICKY_FONT_FAMILY}
                      lineHeight={STICKY_LINE_HEIGHT}
                      fontSize={d.fontSize}
                      fontStyle={d.fontWeight === "bold" ? "bold" : "normal"}
                      fill={d.text ? d.color : "#bbb"}
                      wrap="word"
                      listening={false}
                    />
                  </Group>
                );
              }

              if (obj.type === OBJECT_TYPES.image) {
                return (
                  <CanvasImageObject
                    key={obj.id}
                    obj={obj}
                    currentTool={currentTool}
                    cursor={cursor}
                    selected={selectedIds.has(obj.id)}
                    stageRef={stageRef}
                    onSelect={handleObjClick}
                    onDragEnd={handleDragEnd}
                    onResizeEnd={handleImageResizeEnd}
                  />
                );
              }

              return null;
            })}
            <Transformer
              ref={trRef}
              boundBoxFunc={(oldBox, newBox) => {
                if (
                  Math.abs(newBox.width) < MIN_DRAW ||
                  Math.abs(newBox.height) < MIN_DRAW
                )
                  return oldBox;
                return newBox;
              }}
              borderStroke="#4F46E5"
              borderStrokeWidth={1.5}
              anchorStroke="#4F46E5"
              anchorFill="white"
              anchorSize={8}
              anchorStrokeWidth={1}
              anchorCornerRadius={2}
              rotateEnabled={false}
            />
            {drawPreview && (
              <Rect
                x={drawPreview.x}
                y={drawPreview.y}
                width={drawPreview.width}
                height={drawPreview.height}
                fill={currentTool === "text" ? "rgba(0,0,0,0)" : lastUsedColor}
                opacity={currentTool === "text" ? 1 : 0.4}
                cornerRadius={4}
                stroke="#4F46E5"
                strokeWidth={1.5 / camera.zoom}
                dash={[6 / camera.zoom, 4 / camera.zoom]}
                listening={false}
              />
            )}
          </Layer>
          <Layer
            x={camera.x}
            y={camera.y}
            scaleX={camera.zoom}
            scaleY={camera.zoom}
            listening={false}
          >
            {Array.from(presence.values())
              .filter((p) => p.cursor && p.userId !== guest?.userId)
              .map((p) => (
                <Group key={p.userId} x={p.cursor!.x} y={p.cursor!.y}>
                  <Circle
                    radius={6 / camera.zoom}
                    fill={p.color}
                    stroke="white"
                    strokeWidth={1.5 / camera.zoom}
                  />
                  <Text
                    text={p.displayName}
                    x={10 / camera.zoom}
                    y={-7 / camera.zoom}
                    fontSize={12 / camera.zoom}
                    fontStyle="bold"
                    fill={p.color}
                    stroke="white"
                    strokeWidth={2 / camera.zoom}
                    fillAfterStrokeEnabled
                  />
                </Group>
              ))}
          </Layer>
        </Stage>
      )}

      {editing &&
        (() => {
          const obj = objects.get(editing.objectId);
          if (!obj) return null;

          if (obj.type === OBJECT_TYPES.text) {
            const d: TextData = JSON.parse(obj.dataJson);
            const textFontSize = d.fontSize;
            return (
              <textarea
                ref={textareaRef}
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={finishEditing}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    finishEditing();
                  }
                }}
                className="absolute border-2 border-indigo-500 outline-none resize-none overflow-hidden"
                style={{
                  left: editing.x,
                  top: editing.y,
                  width: editing.width,
                  height: editing.height,
                  fontSize: textFontSize * camera.zoom,
                  lineHeight: STICKY_LINE_HEIGHT,
                  fontWeight: d.fontWeight === "bold" ? 700 : 400,
                  padding: 0,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.9)",
                  color: d.color,
                  fontFamily: STICKY_FONT_FAMILY,
                }}
              />
            );
          }

          const d: StickyNoteData = JSON.parse(obj.dataJson);
          const stickyW = obj.width ?? STICKY_W;
          const stickyH = obj.height ?? STICKY_H;
          const { fontSize: stickyFontSize, lines: stickyLines } =
            computeStickyLayout(
              editingText,
              stickyW - STICKY_PADDING * 2,
              stickyH - STICKY_PADDING * 2,
            );
          const contentHeight = stickyLines * stickyFontSize * STICKY_LINE_HEIGHT;
          const verticalPad = Math.max(
            STICKY_PADDING,
            (stickyH - contentHeight) / 2,
          );
          return (
            <textarea
              ref={textareaRef}
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onBlur={finishEditing}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  finishEditing();
                }
              }}
              className="absolute border-2 border-indigo-500 outline-none resize-none overflow-hidden"
              style={{
                left: editing.x,
                top: editing.y,
                width: editing.width,
                height: editing.height,
                fontSize: stickyFontSize * camera.zoom,
                lineHeight: STICKY_LINE_HEIGHT,
                paddingTop: verticalPad * camera.zoom,
                paddingBottom: verticalPad * camera.zoom,
                paddingLeft: STICKY_PADDING * camera.zoom,
                paddingRight: STICKY_PADDING * camera.zoom,
                borderRadius: 4,
                background: d.backgroundColor,
                color: "#1a1a1a",
                fontFamily: STICKY_FONT_FAMILY,
                textAlign: "center",
              }}
            />
          );
        })()}
    </div>
  );
}
