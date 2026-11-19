import { captureMeta, detectCapture, MAX_CAPTURE_BYTES } from "../orders/logic";
import type { OrderStatus } from "../types";
import type { ProductPatch } from "./schemas";

const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  por_verificar: ["confirmado", "rechazado"],
  confirmado: ["en_preparacion"],
  en_preparacion: ["listo"],
  listo: ["entregado"],
  entregado: [],
  rechazado: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

export function itemsShort(items: readonly { name: string; qty: number }[]): string {
  return items.map((item) => (item.qty === 1 ? item.name : `${item.name} ×${item.qty}`)).join(", ");
}

export function likeContains(value: string): string {
  const escaped = value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  return `%${escaped}%`;
}

export function containsNonAscii(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) > 127) return true;
  }
  return false;
}

export function dayStart(day: string): string {
  return `${day}T00:00:00.000-05:00`;
}

const COLUMN = {
  slug: "slug",
  name: "name",
  price_cents: "price_cents",
  old_price_cents: "old_price_cents",
  prep_days: "prep_days",
  description: "description",
  fields: "fields",
  occasions: "occasions",
  tag: "tag",
  size_classic: "size_classic",
  size_large: "size_large",
  large_extra_cents: "large_extra_cents",
  active: "active",
} as const;

export type ProductColumn = keyof typeof COLUMN;

export type Assignment = { column: ProductColumn; value: string | number | null };

export function patchAssignments(input: ProductPatch): Assignment[] {
  const assignments: Assignment[] = [];
  if (input.slug !== undefined) assignments.push({ column: "slug", value: input.slug });
  if (input.name !== undefined) assignments.push({ column: "name", value: input.name });
  if (input.priceCents !== undefined)
    assignments.push({ column: "price_cents", value: input.priceCents });
  if (input.oldPriceCents !== undefined)
    assignments.push({ column: "old_price_cents", value: input.oldPriceCents });
  if (input.prepDays !== undefined)
    assignments.push({ column: "prep_days", value: input.prepDays });
  if (input.description !== undefined)
    assignments.push({ column: "description", value: input.description });
  if (input.fields !== undefined)
    assignments.push({ column: "fields", value: JSON.stringify(input.fields) });
  if (input.occasions !== undefined)
    assignments.push({ column: "occasions", value: JSON.stringify(input.occasions) });
  if (input.tag !== undefined) assignments.push({ column: "tag", value: input.tag });
  if (input.sizes !== undefined) {
    assignments.push({ column: "size_classic", value: input.sizes.classic });
    assignments.push({ column: "size_large", value: input.sizes.large });
    assignments.push({ column: "large_extra_cents", value: input.sizes.largeExtraCents });
  }
  if (input.active !== undefined)
    assignments.push({ column: "active", value: input.active ? 1 : 0 });
  return assignments;
}

export function updateProductsSql(columns: readonly ProductColumn[]): string {
  const sets = columns.map((column) => `${COLUMN[column]} = ?`).join(", ");
  return `UPDATE products SET ${sets} WHERE id = ? RETURNING id`;
}

export type PhotoCheck =
  | { ok: true; extension: string; contentType: string }
  | { ok: false; reason: "file_too_large" | "unsupported_file_type" };

export function inspectPhoto(bytes: Uint8Array): PhotoCheck {
  if (bytes.byteLength > MAX_CAPTURE_BYTES) return { ok: false, reason: "file_too_large" };
  const kind = detectCapture(bytes);
  if (kind === null) return { ok: false, reason: "unsupported_file_type" };
  const meta = captureMeta(kind);
  return { ok: true, extension: meta.extension, contentType: meta.contentType };
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return "";
  const cause = error.cause;
  const causeText = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  return `${error.message} ${causeText}`;
}

export function isSlugConflict(error: unknown): boolean {
  const text = errorText(error);
  return text.includes("UNIQUE") && text.includes("products.slug");
}

export function isPhotoPositionConflict(error: unknown): boolean {
  const text = errorText(error);
  return text.includes("UNIQUE") && text.includes("product_photos");
}
