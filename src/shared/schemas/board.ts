import { z } from "zod";

export const createBoardSchema = z.object({
  title: z.string().min(1).max(200),
});

export const updateBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  accessToken: z.string().max(100).nullable().optional(),
});

export const boardObjectCreateSchema = z.object({
  type: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().nullable().default(null),
  height: z.number().nullable().default(null),
  rotation: z.number().default(0),
  zIndex: z.string().default("a0"),
  dataJson: z.string(),
});

export const boardObjectUpdateSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  rotation: z.number().optional(),
  zIndex: z.string().optional(),
  dataJson: z.string().optional(),
});
