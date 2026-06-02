"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Rect } from "react-konva";
import type Konva from "konva";
import type { BoardObject } from "@/shared/types";
import type { ImageData } from "@/shared/object-types";
import {
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
} from "@/shared/object-types";
import { fileContentUrl } from "@/shared/file-urls";

interface CanvasImageObjectProps {
  obj: BoardObject;
  currentTool: string;
  cursor: string;
  selected: boolean;
  stageRef: React.RefObject<Konva.Stage | null>;
  onSelect: (id: string, e: Konva.KonvaEventObject<Event>) => void;
  onDragEnd: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onResizeEnd: (
    id: string,
    geometry: { x: number; y: number; width: number; height: number },
  ) => void;
}

export function CanvasImageObject({
  obj,
  currentTool,
  cursor,
  selected,
  stageRef,
  onSelect,
  onDragEnd,
  onResizeEnd,
}: CanvasImageObjectProps) {
  const d: ImageData = JSON.parse(obj.dataJson);
  const w = obj.width ?? DEFAULT_IMAGE_WIDTH;
  const h = obj.height ?? DEFAULT_IMAGE_HEIGHT;
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    img.src = fileContentUrl(d.fileId);
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [d.fileId]);

  return (
    <Group
      key={obj.id}
      id={obj.id}
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation}
      draggable={currentTool === "select"}
      onClick={(e) => onSelect(obj.id, e)}
      onTap={(e) => onSelect(obj.id, e)}
      onDragStart={(e) => {
        e.cancelBubble = true;
        onSelect(obj.id, e);
      }}
      onDragEnd={(e) => onDragEnd(obj.id, e)}
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
        const child = (node as Konva.Group).getChildren()[0];
        if (!child) return;
        const newW = Math.max(80, child.width() * sx);
        const newH = Math.max(80, child.height() * sy);
        child.width(newW);
        child.height(newH);
        node.scaleX(1);
        node.scaleY(1);
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        const child = (node as Konva.Group).getChildren()[0];
        node.scaleX(1);
        node.scaleY(1);
        onResizeEnd(obj.id, {
          x: node.x(),
          y: node.y(),
          width: Math.round(child?.width() ?? w),
          height: Math.round(child?.height() ?? h),
        });
      }}
    >
      {failed || !image ? (
        <Rect
          width={w}
          height={h}
          fill="#f3f4f6"
          stroke="#d1d5db"
          strokeWidth={1}
          cornerRadius={4}
        />
      ) : (
        <KonvaImage
          image={image}
          width={w}
          height={h}
          alt={d.alt ?? "Board image"}
        />
      )}
    </Group>
  );
}
