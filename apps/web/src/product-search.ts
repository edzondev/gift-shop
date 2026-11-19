import { photoNotice } from "./product-errors";

const AVISOS = [
  "too_many_photos",
  "file_too_large",
  "unsupported_file_type",
  "photo_failed",
] as const;

export type PhotoAviso = (typeof AVISOS)[number];

export function productAviso(search: Record<string, unknown>): { aviso?: PhotoAviso } {
  const aviso = search.aviso;
  if (typeof aviso !== "string") return {};
  for (const item of AVISOS) {
    if (item === aviso) return { aviso: item };
  }
  return {};
}

export function avisoText(aviso: PhotoAviso | undefined): string | null {
  if (aviso === undefined) return null;
  if (aviso === "photo_failed") return "No pudimos subir la foto.";
  return photoNotice(aviso);
}
