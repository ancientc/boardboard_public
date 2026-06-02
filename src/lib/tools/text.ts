/**
 * Text creation tool: Idle → Pointing → Idle (creates on click).
 */
export type TextToolState = "idle" | "pointing";

export interface TextToolContext {
  state: TextToolState;
}

export function createTextTool(): TextToolContext {
  return { state: "idle" };
}

export function onPointerDown(ctx: TextToolContext): TextToolContext {
  return { ...ctx, state: "pointing" };
}

export function onPointerUp(
  ctx: TextToolContext,
  createAt: { x: number; y: number },
  onCreate: (x: number, y: number) => void,
): TextToolContext {
  if (ctx.state === "pointing") {
    onCreate(createAt.x, createAt.y);
  }
  return { ...ctx, state: "idle" };
}
