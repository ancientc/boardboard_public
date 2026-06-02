import type { ObjectUtil } from "./base";
import { stickyNoteUtil } from "./sticky-note";
import { textUtil } from "./text";

const registry = new Map<string, ObjectUtil>();

export function registerObjectUtil(util: ObjectUtil) {
  registry.set(util.type, util);
}

export function getObjectUtil(type: string): ObjectUtil | undefined {
  return registry.get(type);
}

export function getAllObjectUtils(): ObjectUtil[] {
  return Array.from(registry.values());
}

registerObjectUtil(stickyNoteUtil);
registerObjectUtil(textUtil);
