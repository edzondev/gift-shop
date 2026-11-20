import type { ProductCard } from "api";
import { isProductCard } from "./product-json";
import { isRecord } from "./record";

export type FeaturedShelf =
  | { kind: "ready"; items: ProductCard[] }
  | { kind: "empty" }
  | { kind: "unavailable" };

export function shelfFromDirectCall(value: unknown): FeaturedShelf | null {
  if (!isRecord(value)) return null;
  if (value.kind === "empty") return { kind: "empty" };
  if (value.kind === "unavailable") return { kind: "unavailable" };
  if (value.kind !== "ready" || !Array.isArray(value.items)) return null;
  if (!value.items.every(isProductCard)) return null;
  return { kind: "ready", items: value.items };
}

export function spotlightOf(shelf: FeaturedShelf): ProductCard | null {
  if (shelf.kind !== "ready") return null;
  return shelf.items[0] ?? null;
}
