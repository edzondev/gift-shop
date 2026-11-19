import { expect, it } from "vitest";
import { canAddGift } from "../src/cart/logic";

const base = {
  inStock: true,
  fields: ["nombre", "color"] as const,
  name: "Ana",
  card: false,
  message: "",
  quantity: 1,
  stockLeft: 4,
};

it("requires active fields and stock before adding", () => {
  expect(canAddGift({ ...base, name: "" })).toBe(false);
  expect(canAddGift({ ...base, inStock: false })).toBe(false);
  expect(canAddGift({ ...base, name: "   " })).toBe(false);
  expect(canAddGift({ ...base, fields: ["tarjeta"], card: true, message: "" })).toBe(false);
  expect(canAddGift(base)).toBe(true);
});
