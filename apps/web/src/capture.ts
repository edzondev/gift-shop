export const MAX_CAPTURE_BYTES = 5 * 1024 * 1024;

const CAPTURE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type CaptureType = (typeof CAPTURE_TYPES)[number];

export function isCaptureType(type: string): type is CaptureType {
  switch (type) {
    case "image/jpeg":
    case "image/png":
    case "image/webp":
      return true;
    default:
      return false;
  }
}

export function captureError(file: { size: number; type: string } | null): string | null {
  if (file === null) return "Sube la captura de tu Yape";
  if (file.size > MAX_CAPTURE_BYTES) return "La captura supera 5 MB. Sube una imagen más liviana.";
  if (!isCaptureType(file.type)) return "La captura tiene que ser JPG, PNG o WebP.";
  return null;
}
