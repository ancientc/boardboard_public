/**
 * Sticky-note creation tool: Idle → Pointing → Idle (creates on click).
 */
export type StickyNoteToolState = "idle" | "pointing";

export interface StickyNoteToolContext {
  state: StickyNoteToolState;
}

export function createStickyNoteTool(): StickyNoteToolContext {
  return { state: "idle" };
}

export function onPointerDown(ctx: StickyNoteToolContext): StickyNoteToolContext {
  return { ...ctx, state: "pointing" };
}

export function onPointerUp(
  ctx: StickyNoteToolContext,
  createAt: { x: number; y: number },
  onCreate: (x: number, y: number) => void,
): StickyNoteToolContext {
  if (ctx.state === "pointing") {
    onCreate(createAt.x, createAt.y);
  }
  return { ...ctx, state: "idle" };
}
