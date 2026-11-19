import { encodedImageKey } from "./image-key";

export type PhotoFrame = "main" | "thumb";

const MAIN_WIDTH = 800;
const MAIN_HEIGHT = 1000;
const THUMB_SIZE = 400;
const GALLERY_LIMIT = 3;

export type PhotoView =
  | { kind: "filler" }
  | {
      kind: "image";
      src: string;
      alt: string;
      width: number;
      height: number;
      loading: "eager" | "lazy";
      fetchPriority: "high" | "low";
    };

export function photoView(input: {
  photoKey: string | undefined;
  label: string;
  frame: PhotoFrame;
  priority: boolean;
  broken: boolean;
}): PhotoView {
  if (input.broken || input.photoKey === undefined) return { kind: "filler" };
  const encoded = encodedImageKey(input.photoKey);
  if (encoded === null) return { kind: "filler" };
  const main = input.frame === "main";
  const eager = input.priority && main;
  return {
    kind: "image",
    src: `/img/${encoded}`,
    alt: input.label,
    width: main ? MAIN_WIDTH : THUMB_SIZE,
    height: main ? MAIN_HEIGHT : THUMB_SIZE,
    loading: eager ? "eager" : "lazy",
    fetchPriority: eager ? "high" : "low",
  };
}

export function photoIsBroken(failedKey: string | null, photoKey: string | undefined): boolean {
  return photoKey !== undefined && failedKey === photoKey;
}

export function galleryKeys(photoKeys: readonly string[]): readonly string[] {
  return photoKeys.slice(0, GALLERY_LIMIT);
}

export function choosePhoto(count: number, index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= count) return 0;
  return index;
}

export function leadingPhotoIndex(counts: readonly number[]): number {
  return counts.findIndex((count) => count > 0);
}
