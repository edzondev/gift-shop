import type { InferOutput } from "valibot";
import type { CreateOrderInput, Field } from "../types";
import type { storedOptionsSchema } from "./schemas";

export const MAX_CAPTURE_BYTES = 5 * 1024 * 1024;
export const MAX_BODY_BYTES = 6 * 1024 * 1024;
export const CARD_CENTS = 500;
export const WRAP_CENTS = 800;

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ZEROS = new Uint8Array(32);

export type CaptureKind = "jpeg" | "png" | "webp";

type Item = CreateOrderInput["items"][number];
type StoredOptions = InferOutput<typeof storedOptionsSchema>;

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (bytes[index] !== prefix[index]) return false;
  }
  return true;
}

export function detectCapture(bytes: Uint8Array): CaptureKind | null {
  if (hasPrefix(bytes, JPEG)) return "jpeg";
  if (hasPrefix(bytes, PNG)) return "png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export function captureMeta(kind: CaptureKind): { extension: string; contentType: string } {
  switch (kind) {
    case "jpeg":
      return { extension: "jpg", contentType: "image/jpeg" };
    case "png":
      return { extension: "png", contentType: "image/png" };
    case "webp":
      return { extension: "webp", contentType: "image/webp" };
  }
}

function hex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

async function sha256(bytes: BufferSource): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export async function requestHash(orderText: string, capture: Uint8Array): Promise<string> {
  const order = hex(await sha256(new TextEncoder().encode(orderText)));
  const file = hex(await sha256(capture));
  return order + file;
}

export function newOrderToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function tokenHash(token: string): Promise<string> {
  return hex(await sha256(new TextEncoder().encode(token)));
}

function hexToBytes(value: string): Uint8Array | null {
  if (value.length % 2 !== 0 || !/^[0-9a-f]+$/.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function tokenMatches(token: string, tokenHashHex: string): Promise<boolean> {
  const actual = await sha256(new TextEncoder().encode(token));
  const expected = hexToBytes(tokenHashHex);
  const comparable = expected !== null && expected.length === actual.length ? expected : ZEROS;
  const equal = crypto.subtle.timingSafeEqual(actual, comparable);
  return equal && expected !== null && expected.length === actual.length;
}

export function orderCode(createdAt: string, id: number): string {
  return `REG-${createdAt.slice(0, 4)}-${String(id).padStart(4, "0")}`;
}

export function orderCodeParts(code: string): { year: string; id: number } | null {
  const match = /^REG-(\d{4})-(\d{4,})$/.exec(code);
  if (match === null) return null;
  const year = match[1];
  const raw = match[2];
  if (year === undefined || raw === undefined) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) return null;
  return { year, id };
}

export function orderIdFromCode(code: string): number | null {
  return orderCodeParts(code)?.id ?? null;
}

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;

export function limaTimestamp(now: Date): string {
  return new Date(now.getTime() - LIMA_OFFSET_MS).toISOString().replace("Z", "-05:00");
}

export function limaToday(now: Date): string {
  return limaTimestamp(now).slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function earliestDeliveryDate(today: string, prepDays: readonly number[]): string {
  let highest = 0;
  for (const days of prepDays) if (days > highest) highest = days;
  return addDays(today, Math.max(3, highest));
}

export function unitPriceCents(
  product: { priceCents: number; largeExtraCents: number },
  item: Pick<Item, "size" | "card" | "wrap">,
): number {
  let cents = product.priceCents;
  if (item.size === "grande") cents += product.largeExtraCents;
  if (item.card !== undefined) cents += CARD_CENTS;
  if (item.wrap === true) cents += WRAP_CENTS;
  return cents;
}

export function deliveryCostCents(mode: CreateOrderInput["delivery"]["mode"]): number | null {
  return mode === "estacion" ? 0 : null;
}

const UNAVAILABLE_OPTIONS: {
  key: "name" | "color" | "size" | "card" | "wrap";
  field: Field;
  isSet: (item: Item) => boolean;
}[] = [
  { key: "name", field: "nombre", isSet: (item) => item.name !== undefined },
  { key: "color", field: "color", isSet: (item) => item.color !== undefined },
  { key: "size", field: "tamano", isSet: (item) => item.size === "grande" },
  { key: "card", field: "tarjeta", isSet: (item) => item.card !== undefined },
  { key: "wrap", field: "envoltura", isSet: (item) => item.wrap === true },
];

export function unavailableOptionIssues(
  items: readonly Item[],
  fieldsByProduct: ReadonlyMap<string, readonly Field[]>,
): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  for (const [index, item] of items.entries()) {
    const fields = fieldsByProduct.get(item.productId) ?? [];
    for (const option of UNAVAILABLE_OPTIONS) {
      if (!option.isSet(item) || fields.includes(option.field)) continue;
      issues.push({
        path: `items.${index}.${option.key}`,
        message: `${option.key} is not available for this product`,
      });
    }
  }
  return issues;
}

export function optionsJson(item: Item): string {
  const options: Record<string, unknown> = { size: item.size };
  if (item.name !== undefined) options.name = item.name;
  if (item.color !== undefined) options.color = item.color;
  if (item.card !== undefined) options.card = { message: item.card.message };
  if (item.wrap !== undefined) options.wrap = item.wrap;
  return JSON.stringify(options);
}

export function optionLabels(options: StoredOptions): {
  labels: string[];
  cardMessage: string | null;
} {
  const labels = [options.size === "grande" ? "Grande" : "Clásica"];
  if (options.name !== undefined) labels.push(`Nombre: ${options.name}`);
  if (options.color !== undefined) labels.push(`Color: ${options.color}`);
  if (options.wrap === true) labels.push("Envoltura");
  return { labels, cardMessage: options.card === undefined ? null : options.card.message };
}

export function requestedQuantities(
  items: readonly { productId: string; qty: number }[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items)
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.qty);
  return totals;
}

export function uniqueProductIds(items: readonly { productId: string }[]): string[] {
  const ids: string[] = [];
  for (const item of items) if (!ids.includes(item.productId)) ids.push(item.productId);
  return ids;
}
