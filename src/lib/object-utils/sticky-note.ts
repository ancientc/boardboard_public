import { createElement } from "react";
import { Rect, Text, Group } from "react-konva";
import type { ObjectUtil } from "./base";
import type { BoardObject } from "@/shared/types";
import type { StickyNoteData } from "@/shared/object-types";
import { OBJECT_TYPES } from "@/shared/object-types";
import { Rectangle } from "@/lib/geometry/rectangle";

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 200;

function parseData(obj: BoardObject): StickyNoteData {
  return JSON.parse(obj.dataJson);
}

export const stickyNoteUtil: ObjectUtil<StickyNoteData> = {
  type: OBJECT_TYPES.stickyNote,

  getDefaultProps(): StickyNoteData {
    return {
      text: "",
      backgroundColor: "#FFE066",
      fontSize: 16,
    };
  },

  getGeometry(obj: BoardObject): Rectangle {
    return new Rectangle(
      obj.x,
      obj.y,
      obj.width ?? DEFAULT_WIDTH,
      obj.height ?? DEFAULT_HEIGHT,
    );
  },

  component(obj: BoardObject) {
    const data = parseData(obj);
    const w = obj.width ?? DEFAULT_WIDTH;
    const h = obj.height ?? DEFAULT_HEIGHT;

    return createElement(
      Group,
      { x: obj.x, y: obj.y, rotation: obj.rotation },
      createElement(Rect, {
        width: w,
        height: h,
        fill: data.backgroundColor,
        cornerRadius: 4,
        shadowColor: "rgba(0,0,0,0.12)",
        shadowBlur: 8,
        shadowOffsetY: 2,
      }),
      createElement(Text, {
        text: data.text,
        width: w - 16,
        height: h - 16,
        x: 8,
        y: 8,
        fontSize: data.fontSize,
        fill: "#1a1a1a",
        wrap: "word",
      }),
    );
  },

  indicator(obj: BoardObject) {
    const w = obj.width ?? DEFAULT_WIDTH;
    const h = obj.height ?? DEFAULT_HEIGHT;

    return createElement(Rect, {
      x: obj.x,
      y: obj.y,
      width: w,
      height: h,
      rotation: obj.rotation,
      stroke: "#4F46E5",
      strokeWidth: 2,
      dash: [6, 3],
      listening: false,
    });
  },
};
