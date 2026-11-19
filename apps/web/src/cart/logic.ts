import type { CreateOrderInput, Field, ProductDetail } from "api";
import * as v from "valibot";
import { COLORS } from "../labels";
import { unitPriceCents } from "../price";
import { quantityCap } from "../quantity";

export type ItemInput = CreateOrderInput["items"][number];

export const MAX_QTY = 20;

const sizes = ["clasica", "grande"] as const;

export type CartLine = ItemInput & {
  productName: string;
  slug: string;
  unitPriceCents: number;
  prepDays: number;
  stockLeft: number | null;
};

const lineSchema = v.pipe(
  v.object({
    productId: v.pipe(v.string(), v.minLength(1)),
    qty: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_QTY)),
    size: v.picklist(sizes),
    name: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(14))),
    color: v.exactOptional(v.picklist(COLORS)),
    card: v.exactOptional(
      v.object({
        message: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
      }),
    ),
    wrap: v.exactOptional(v.boolean()),
    productName: v.pipe(v.string(), v.minLength(1)),
    slug: v.pipe(v.string(), v.minLength(1)),
    unitPriceCents: v.pipe(v.number(), v.integer(), v.minValue(0)),
    prepDays: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(30)),
    stockLeft: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  }),
  v.check((line) => line.qty <= maxQty(line.stockLeft)),
);

const cartSchema = v.array(lineSchema);

export function maxQty(stockLeft: number | null): number {
  return quantityCap(stockLeft);
}

export function canAddGift(input: {
  inStock: boolean;
  fields: readonly Field[];
  name: string;
  card: boolean;
  message: string;
  quantity: number;
  stockLeft: number | null;
}): boolean {
  if (!input.inStock) return false;
  const cap = quantityCap(input.stockLeft);
  if (input.quantity < 1 || input.quantity > cap) return false;
  if (input.fields.includes("nombre") && input.name.trim().length === 0) return false;
  if (input.fields.includes("tarjeta") && input.card && input.message.trim().length === 0)
    return false;
  return true;
}

export function lineFromProduct(
  product: ProductDetail,
  draft: {
    name: string;
    color: ItemInput["color"];
    size: ItemInput["size"];
    card: boolean;
    message: string;
    wrap: boolean;
    qty: number;
  },
): CartLine | null {
  const fields = product.fields;
  if (
    !canAddGift({
      inStock: product.inStock,
      fields,
      name: draft.name,
      card: draft.card,
      message: draft.message,
      quantity: draft.qty,
      stockLeft: product.stockLeft,
    })
  ) {
    return null;
  }
  const size = fields.includes("tamano") ? draft.size : "clasica";
  const card = fields.includes("tarjeta") && draft.card;
  const wrap = fields.includes("envoltura") && draft.wrap;
  const line: CartLine = {
    productId: product.id,
    qty: draft.qty,
    size,
    productName: product.name,
    slug: product.slug,
    unitPriceCents: unitPriceCents(
      { priceCents: product.priceCents, largeExtraCents: product.sizes.largeExtraCents },
      { size, card, wrap },
    ),
    prepDays: product.prepDays,
    stockLeft: product.stockLeft,
  };
  const personalName = draft.name.trim();
  if (fields.includes("nombre") && personalName.length > 0) line.name = personalName;
  if (fields.includes("color") && draft.color !== undefined) line.color = draft.color;
  const message = draft.message.trim();
  if (card && message.length > 0) line.card = { message };
  if (wrap) line.wrap = true;
  return line;
}

export function configKey(
  line: Pick<CartLine, "productId" | "size" | "name" | "color" | "card" | "wrap">,
): string {
  return JSON.stringify({
    productId: line.productId,
    size: line.size,
    name: line.name ?? null,
    color: line.color ?? null,
    card: line.card?.message ?? null,
    wrap: line.wrap === true,
  });
}

export function parseCart(value: unknown): CartLine[] {
  const parsed = v.safeParse(cartSchema, value);
  if (!parsed.success) return [];
  return parsed.output;
}

export function parseStoredCart(raw: string | null): CartLine[] {
  if (raw === null) return [];
  try {
    return parseCart(parseJson(raw));
  } catch {
    return [];
  }
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw);
}

export function addLine(cart: readonly CartLine[], line: CartLine): readonly CartLine[] {
  const cap = maxQty(line.stockLeft);
  if (line.qty < 1 || cap < 1) return cart;
  const qty = Math.min(line.qty, cap);
  const key = configKey(line);
  const index = cart.findIndex((item) => configKey(item) === key);
  if (index === -1) return [...cart, { ...line, qty }];
  const current = cart[index];
  if (current === undefined) return cart;
  const nextQty = Math.min(current.qty + qty, maxQty(current.stockLeft));
  if (nextQty === current.qty) return cart;
  return cart.map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...line,
          qty: nextQty,
        }
      : item,
  );
}

export function setLineQty(
  cart: readonly CartLine[],
  key: string,
  qty: number,
): readonly CartLine[] {
  return cart.flatMap((line) => {
    if (configKey(line) !== key) return [line];
    const cap = maxQty(line.stockLeft);
    if (qty < 1 || cap < 1) return [];
    return [{ ...line, qty: Math.min(Math.trunc(qty), cap) }];
  });
}

export function removeLine(cart: readonly CartLine[], key: string): readonly CartLine[] {
  return cart.filter((line) => configKey(line) !== key);
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

export function cartSubtotalCents(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPriceCents * line.qty, 0);
}

export const CART_STORAGE_KEY = "gift-shop.cart";

export function cartFromStorage(
  key: string | null,
  value: string | null,
  current: readonly CartLine[],
): readonly CartLine[] {
  if (key !== null && key !== CART_STORAGE_KEY) return current;
  return parseStoredCart(value);
}
