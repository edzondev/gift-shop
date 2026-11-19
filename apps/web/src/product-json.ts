import type { Field, Occasion, Page, ProductCard, ProductDetail } from "api";
import { OCCASION_IDS } from "./occasions";
import { isRecord } from "./record";

const FIELDS = [
  "nombre",
  "color",
  "tamano",
  "tarjeta",
  "envoltura",
] as const satisfies readonly Field[];

function isOccasion(value: unknown): value is Occasion {
  return OCCASION_IDS.some((occasion) => occasion === value);
}

function isField(value: unknown): value is Field {
  return FIELDS.some((field) => field === value);
}

export function isProductCard(value: unknown): value is ProductCard {
  if (!isRecord(value)) return false;
  return (
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    typeof value.priceCents === "number" &&
    (value.oldPriceCents === null || typeof value.oldPriceCents === "number") &&
    (value.tag === null || typeof value.tag === "string") &&
    Array.isArray(value.occasions) &&
    value.occasions.every(isOccasion) &&
    typeof value.prepDays === "number" &&
    Array.isArray(value.photoKeys) &&
    value.photoKeys.every((key) => typeof key === "string") &&
    typeof value.customizable === "boolean" &&
    (value.stockLeft === null || typeof value.stockLeft === "number")
  );
}

export function isProductPage(value: unknown): value is Page<ProductCard> {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.items) &&
    value.items.every(isProductCard) &&
    (value.nextCursor === null || typeof value.nextCursor === "string")
  );
}

function hasDetail(value: Record<string, unknown>): boolean {
  const sizes = value.sizes;
  return (
    typeof value.id === "string" &&
    typeof value.description === "string" &&
    Array.isArray(value.fields) &&
    value.fields.every(isField) &&
    typeof value.inStock === "boolean" &&
    isRecord(sizes) &&
    typeof sizes.classic === "string" &&
    typeof sizes.large === "string" &&
    typeof sizes.largeExtraCents === "number"
  );
}

export function isProductDetail(value: unknown): value is ProductDetail {
  return isRecord(value) && hasDetail(value) && isProductCard(value);
}
