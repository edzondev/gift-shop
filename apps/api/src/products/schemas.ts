import * as v from "valibot";

const LIMIT_MESSAGE = "limit must be an integer from 1 to 50";

export const occasionSchema = v.picklist(
  ["cumple", "aniversario", "sanvalentin", "mama", "bebe"],
  "unknown occasion",
);

export const fieldSchema = v.picklist(["nombre", "color", "tamano", "tarjeta", "envoltura"]);

export const occasionsSchema = v.array(occasionSchema);
export const fieldsSchema = v.array(fieldSchema);

export function encodeCursor(id: string): string {
  const bytes = new TextEncoder().encode(id);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decodeCursor(cursor: string): string | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return undefined;
  const padding = "=".repeat((4 - (cursor.length % 4)) % 4);
  const base64 = `${cursor.replaceAll("-", "+").replaceAll("_", "/")}${padding}`;
  let binary: string;
  try {
    binary = atob(base64);
  } catch (error) {
    if (error instanceof Error) return undefined;
    throw error;
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  let id: string;
  try {
    id = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch (error) {
    if (error instanceof Error) return undefined;
    throw error;
  }
  if (id.length === 0 || encodeCursor(id) !== cursor) return undefined;
  return id;
}

const cursorSchema = v.pipe(v.string(), v.transform(decodeCursor), v.string("cursor is invalid"));

const limitSchema = v.pipe(
  v.string(),
  v.regex(/^\d+$/, LIMIT_MESSAGE),
  v.transform(Number),
  v.minValue(1, LIMIT_MESSAGE),
  v.maxValue(50, LIMIT_MESSAGE),
);

export const listQuerySchema = v.pipe(
  v.object({
    occasion: v.optional(occasionSchema),
    cursor: v.optional(cursorSchema),
    limit: v.optional(limitSchema),
  }),
  v.transform((query) => ({
    occasion: query.occasion,
    cursor: query.cursor,
    limit: query.limit ?? 20,
  })),
);

export const slugParamSchema = v.object({
  slug: v.string(),
});

export type ListQuery = v.InferOutput<typeof listQuerySchema>;
