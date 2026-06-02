import { z } from "zod";

export const OBJECT_TYPES = {
  stickyNote: "sticky_note",
  text: "text",
  image: "image",
} as const;

export type ObjectType = (typeof OBJECT_TYPES)[keyof typeof OBJECT_TYPES];

// Discrete scale of allowed text font sizes. Text font sizes are always
// snapped to one of these values, both from the properties panel and when
// resizing a text box by its corner handles.
export const TEXT_FONT_SIZES = [
  10, 12, 14, 18, 24, 36, 48, 64, 80, 144, 288,
] as const;

export const DEFAULT_TEXT_FONT_SIZE = 18;

// Returns the closest value in TEXT_FONT_SIZES to the given size.
export function snapFontSize(size: number): number {
  return TEXT_FONT_SIZES.reduce((best, candidate) =>
    Math.abs(candidate - size) < Math.abs(best - size) ? candidate : best,
  );
}

export const stickyNoteDataSchema = z.object({
  text: z.string().default(""),
  backgroundColor: z.string().default("#FFE066"),
  fontSize: z.number().default(16),
});

export type StickyNoteData = z.infer<typeof stickyNoteDataSchema>;

export const textDataSchema = z.object({
  text: z.string().default(""),
  fontSize: z.number().default(DEFAULT_TEXT_FONT_SIZE),
  color: z.string().default("#1a1a1a"),
  fontWeight: z.enum(["normal", "bold"]).default("normal"),
});

export type TextData = z.infer<typeof textDataSchema>;

export const imageDataSchema = z.object({
  fileId: z.string(),
  alt: z.string().optional(),
  objectFit: z.enum(["contain", "cover"]).default("contain"),
});

export type ImageData = z.infer<typeof imageDataSchema>;

export const objectDataSchemas = {
  [OBJECT_TYPES.stickyNote]: stickyNoteDataSchema,
  [OBJECT_TYPES.text]: textDataSchema,
  [OBJECT_TYPES.image]: imageDataSchema,
} as const;

/** Default display size when natural dimensions are unknown. */
export const DEFAULT_IMAGE_WIDTH = 320;
export const DEFAULT_IMAGE_HEIGHT = 240;
