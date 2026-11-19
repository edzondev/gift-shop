export const QUANTITY_MAX = 20;

export function quantityCap(stockLeft: number | null): number {
  if (stockLeft === null) return QUANTITY_MAX;
  if (stockLeft < 1) return 0;
  return Math.min(QUANTITY_MAX, stockLeft);
}

export function clampQuantity(quantity: number, stockLeft: number | null): number {
  const cap = quantityCap(stockLeft);
  if (cap < 1) return 0;
  if (quantity < 1) return 1;
  if (quantity > cap) return cap;
  return quantity;
}
