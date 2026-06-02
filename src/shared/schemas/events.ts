import { z } from "zod";
import { SCOPES } from "../scopes";

const baseEventSchema = z.object({
  boardId: z.string(),
  userId: z.string().optional(),
  timestamp: z.string(),
});

export const objectCreatedSchema = baseEventSchema.extend({
  type: z.literal("object_created"),
  scope: z.literal(SCOPES.document),
  payload: z.object({
    objectId: z.string(),
    objectType: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    rotation: z.number(),
    zIndex: z.string(),
    dataJson: z.string(),
  }),
});

export const objectUpdatedSchema = baseEventSchema.extend({
  type: z.literal("object_updated"),
  scope: z.literal(SCOPES.document),
  payload: z.object({
    objectId: z.string(),
    partial: z.record(z.unknown()),
  }),
});

export const objectDeletedSchema = baseEventSchema.extend({
  type: z.literal("object_deleted"),
  scope: z.literal(SCOPES.document),
  payload: z.object({
    objectId: z.string(),
  }),
});

export const cursorMovedSchema = baseEventSchema.extend({
  type: z.literal("cursor_moved"),
  scope: z.literal(SCOPES.presence),
  payload: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export const selectionChangedSchema = baseEventSchema.extend({
  type: z.literal("selection_changed"),
  scope: z.literal(SCOPES.presence),
  payload: z.object({
    objectIds: z.array(z.string()),
  }),
});

export const userJoinedSchema = baseEventSchema.extend({
  type: z.literal("user_joined"),
  scope: z.literal(SCOPES.presence),
  payload: z.object({
    displayName: z.string(),
    color: z.string(),
  }),
});

export const userLeftSchema = baseEventSchema.extend({
  type: z.literal("user_left"),
  scope: z.literal(SCOPES.presence),
  payload: z.object({}),
});

export const stateSnapshotSchema = baseEventSchema.extend({
  type: z.literal("state_snapshot"),
  scope: z.literal(SCOPES.document),
  payload: z.object({
    objects: z.array(z.record(z.unknown())),
    presence: z.array(z.record(z.unknown())),
  }),
});

export const clientEventSchema = z.discriminatedUnion("type", [
  objectCreatedSchema,
  objectUpdatedSchema,
  objectDeletedSchema,
  cursorMovedSchema,
  selectionChangedSchema,
  userJoinedSchema,
]);

export const serverEventSchema = z.discriminatedUnion("type", [
  objectCreatedSchema,
  objectUpdatedSchema,
  objectDeletedSchema,
  cursorMovedSchema,
  selectionChangedSchema,
  userJoinedSchema,
  userLeftSchema,
  stateSnapshotSchema,
]);

export type ClientEvent = z.infer<typeof clientEventSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;
