import { createElement } from "react";
import { Rect, Text, Group } from "react-konva";
import type { ObjectUtil } from "./base";
import type { BoardObject } from "@/shared/types";
import type { TextData } from "@/shared/object-types";
import { OBJECT_TYPES } from "@/shared/object-types";
import { Rectangle } from "@/lib/geometry/rectangle";

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 60;

function parseData(obj: BoardObject): TextData {
  return JSON.parse(obj.dataJson);
}

export const textUtil: ObjectUtil<TextData> = {
  type: OBJECT_TYPES.text,

  getDefaultProps(): TextData {
    return {
      text: "",
      fontSize: 20,
      color: "#1a1a1a",
      fontWeight: "normal",
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
      createElement(Text, {
        text: data.text,
        width: w,
        height: h,
        fontSize: data.fontSize,
        fontStyle: data.fontWeight === "bold" ? "bold" : "normal",
        fill: data.color,
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
