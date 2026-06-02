/**
 * Select tool state machine: Idle → Pointing → Translating → Idle
 */
export type SelectState = "idle" | "pointing" | "translating";

export interface SelectToolContext {
  state: SelectState;
  startX: number;
  startY: number;
  objectId: string | null;
}

export function createSelectTool(): SelectToolContext {
  return { state: "idle", startX: 0, startY: 0, objectId: null };
}

export function onPointerDown(
  ctx: SelectToolContext,
  x: number,
  y: number,
  hitObjectId: string | null,
): SelectToolContext {
  return { state: "pointing", startX: x, startY: y, objectId: hitObjectId };
}

export function onPointerMove(
  ctx: SelectToolContext,
  _x: number,
  _y: number,
): SelectToolContext {
  if (ctx.state === "pointing" && ctx.objectId) {
    return { ...ctx, state: "translating" };
  }
  return ctx;
}

export function onPointerUp(ctx: SelectToolContext): SelectToolContext {
  return { ...ctx, state: "idle" };
}
