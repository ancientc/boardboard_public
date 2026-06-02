import { z } from "zod";

export const presignRequestSchema = z.object({
  boardId: z.string(),
  filename: z.string().min(1).max(255),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});

export const fileMetadataSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  uploadedBy: z.string().nullable(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  r2Bucket: z.string(),
  r2Key: z.string(),
  publicUrl: z.string().nullable(),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
});

export const finalizeUploadSchema = z.object({
  boardId: z.string(),
  uploadToken: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

export const presignResponseSchema = z.object({
  fileId: z.string(),
  r2Key: z.string(),
  uploadUrl: z.string(),
  uploadToken: z.string(),
  headers: z.object({
    "Content-Type": z.string(),
  }),
});

export type PresignRequest = z.infer<typeof presignRequestSchema>;
export type FileMetadata = z.infer<typeof fileMetadataSchema>;
export type FinalizeUploadRequest = z.infer<typeof finalizeUploadSchema>;
