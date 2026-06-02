import type { ObjectType } from "./object-types";

export interface BoardObject {
  id: string;
  boardId: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  rotation: number;
  zIndex: string;
  dataJson: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Board {
  id: string;
  title: string;
  ownerUserId: string | null;
  accessToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  displayName: string;
  email: string | null;
  createdAt: string;
}

export interface PresenceInfo {
  userId: string;
  displayName: string;
  cursor: { x: number; y: number } | null;
  color: string;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}
