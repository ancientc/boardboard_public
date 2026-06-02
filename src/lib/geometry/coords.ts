import type { Camera } from "@/shared/types";

export function screenToPage(
  camera: Camera,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return {
    x: (sx - camera.x) / camera.zoom,
    y: (sy - camera.y) / camera.zoom,
  };
}

export function pageToScreen(
  camera: Camera,
  px: number,
  py: number,
): { x: number; y: number } {
  return {
    x: px * camera.zoom + camera.x,
    y: py * camera.zoom + camera.y,
  };
}
