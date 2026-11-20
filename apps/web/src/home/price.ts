export function discountPercent(priceCents: number, oldCents: number | null): number | null {
  if (oldCents === null || oldCents <= priceCents) return null;
  const percent = Math.round(((oldCents - priceCents) / oldCents) * 100);
  if (percent < 1) return null;
  return percent;
}
