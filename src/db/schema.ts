import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  createdAt: text("created_at").notNull(),
});

export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  ownerUserId: text("owner_user_id"),
  accessToken: text("access_token"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const boardMembers = sqliteTable("board_members", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull(),
  joinedAt: text("joined_at").notNull(),
});

export const boardObjects = sqliteTable("board_objects", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id),
  type: text("type").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  width: real("width"),
  height: real("height"),
  rotation: real("rotation").default(0),
  zIndex: text("z_index").notNull().default("a0"),
  dataJson: text("data_json").notNull(),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id),
  uploadedBy: text("uploaded_by").references(() => users.id),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  r2Bucket: text("r2_bucket").notNull(),
  r2Key: text("r2_key").notNull(),
  publicUrl: text("public_url"),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const boardEvents = sqliteTable("board_events", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id),
  userId: text("user_id"),
  eventType: text("event_type").notNull(),
  objectId: text("object_id"),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
});
