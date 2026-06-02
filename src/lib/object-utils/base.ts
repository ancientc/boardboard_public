import type { ReactNode } from "react";
import type { BoardObject } from "@/shared/types";
import type { Rectangle } from "@/lib/geometry/rectangle";

/**
 * Every board object type implements this interface.
 * Adding a new type = one new file + one registry entry.
 */
export interface ObjectUtil<T = unknown> {
  type: string;
  getDefaultProps(): T;
  getGeometry(obj: BoardObject): Rectangle;
  component(obj: BoardObject): ReactNode;
  indicator(obj: BoardObject): ReactNode;
}
