import type { AdminProduct, Page } from "api";
import { isProductDetail } from "./product-json";
import { isRecord } from "./record";

export function errorCode(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  return typeof body.error.code === "string" ? body.error.code : null;
}

export function errorIssues(body: unknown): { path: string; message: string }[] | null {
  if (!isRecord(body) || !isRecord(body.error) || !isRecord(body.error.details)) return null;
  const issues = body.error.details.issues;
  if (!Array.isArray(issues)) return null;
  const parsed: { path: string; message: string }[] = [];
  for (const issue of issues) {
    if (!isRecord(issue) || typeof issue.path !== "string" || typeof issue.message !== "string") {
      return null;
    }
    parsed.push({ path: issue.path, message: issue.message });
  }
  return parsed;
}

function photosOf(value: unknown): { id: string; key: string }[] | null {
  if (!Array.isArray(value)) return null;
  const photos: { id: string; key: string }[] = [];
  for (const photo of value) {
    if (!isRecord(photo) || typeof photo.id !== "string" || typeof photo.key !== "string")
      return null;
    photos.push({ id: photo.id, key: photo.key });
  }
  return photos;
}

export function parseAdminProduct(value: unknown): AdminProduct | null {
  if (!isRecord(value)) return null;
  const stock = value.stock;
  const active = value.active;
  const photos = photosOf(value.photos);
  if (!isProductDetail(value) || photos === null) return null;
  if (typeof stock !== "number" || !Number.isFinite(stock) || typeof active !== "boolean")
    return null;
  return { ...value, stock, active, photos };
}

export function parseAdminProductPage(value: unknown): Page<AdminProduct> | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  if (value.nextCursor !== null && typeof value.nextCursor !== "string") return null;
  const items: AdminProduct[] = [];
  for (const item of value.items) {
    const product = parseAdminProduct(item);
    if (product === null) return null;
    items.push(product);
  }
  return { items, nextCursor: value.nextCursor };
}
