import type { GiftSize } from "./order-types";

const CARD_CENTS = 500;
const WRAP_CENTS = 800;

export type UnitChoices = {
  size: GiftSize;
  card: boolean;
  wrap: boolean;
};

export function unitPriceCents(
  product: { priceCents: number; largeExtraCents: number },
  choices: UnitChoices,
): number {
  let cents = product.priceCents;
  if (choices.size === "grande") cents += product.largeExtraCents;
  if (choices.card) cents += CARD_CENTS;
  if (choices.wrap) cents += WRAP_CENTS;
  return cents;
}

export function lineTotalCents(
  product: { priceCents: number; largeExtraCents: number },
  choices: UnitChoices,
  quantity: number,
): number {
  return unitPriceCents(product, choices) * quantity;
}
