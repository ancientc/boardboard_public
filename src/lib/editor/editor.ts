import type { BoardObject, Camera } from "@/shared/types";

/**
 * Central mutation API for the board. All object mutations flow through here
 * so optimistic updates, undo/redo, validation, and sync stay in one place.
 */
export class Editor {
  private objects: Map<string, BoardObject> = new Map();
  private camera: Camera = { x: 0, y: 0, zoom: 1 };
  private onSync?: (event: unknown) => void;

  setObjects(objects: BoardObject[]) {
    this.objects.clear();
    for (const obj of objects) {
      this.objects.set(obj.id, obj);
    }
  }

  getObjects(): BoardObject[] {
    return Array.from(this.objects.values()).filter((o) => !o.deletedAt);
  }

  getObject(id: string): BoardObject | undefined {
    return this.objects.get(id);
  }

  createObject(obj: BoardObject) {
    this.objects.set(obj.id, obj);
    this.onSync?.({ type: "object_created", payload: obj });
  }

  updateObject(id: string, partial: Partial<BoardObject>) {
    const existing = this.objects.get(id);
    if (!existing) return;
    const updated = { ...existing, ...partial, updatedAt: new Date().toISOString() };
    this.objects.set(id, updated);
    this.onSync?.({ type: "object_updated", payload: { objectId: id, partial } });
  }

  deleteObject(id: string) {
    const existing = this.objects.get(id);
    if (!existing) return;
    this.objects.set(id, { ...existing, deletedAt: new Date().toISOString() });
    this.onSync?.({ type: "object_deleted", payload: { objectId: id } });
  }

  getCamera(): Camera {
    return this.camera;
  }

  setCamera(camera: Partial<Camera>) {
    this.camera = { ...this.camera, ...camera };
  }

  screenToPage(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.camera.x) / this.camera.zoom,
      y: (sy - this.camera.y) / this.camera.zoom,
    };
  }

  pageToScreen(px: number, py: number): { x: number; y: number } {
    return {
      x: px * this.camera.zoom + this.camera.x,
      y: py * this.camera.zoom + this.camera.y,
    };
  }

  setSyncHandler(handler: (event: unknown) => void) {
    this.onSync = handler;
  }
}
