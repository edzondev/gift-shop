import { expect, it } from "vitest";
import {
  addLine,
  type CartLine,
  cartFromStorage,
  configKey,
  maxQty,
  parseCart,
  parseStoredCart,
  removeLine,
  setLineQty,
} from "../src/cart/logic";

function line(patch: Partial<CartLine> = {}): CartLine {
  return {
    productId: "p05",
    qty: 1,
    size: "clasica",
    productName: "Ramo para mamá",
    slug: "ramo-para-mama",
    unitPriceCents: 8900,
    prepDays: 3,
    stockLeft: 8,
    ...patch,
  };
}

it("keeps quantity between 1 and 20 and within stockLeft", () => {
  expect(maxQty(null)).toBe(20);
  expect(maxQty(8)).toBe(8);
  expect(maxQty(50)).toBe(20);
  expect(maxQty(0)).toBe(0);

  const cases: ReadonlyArray<readonly [CartLine, number, number | "gone"]> = [
    [line(), 4, 4],
    [line({ qty: 4 }), 30, 8],
    [line({ stockLeft: null, qty: 19 }), 25, 20],
    [line({ qty: 2 }), 0, "gone"],
    [line({ stockLeft: 1, qty: 1 }), 2, 1],
  ];

  for (const [current, nextQty, expected] of cases) {
    const cart = setLineQty([current], configKey(current), nextQty);
    if (expected === "gone") expect(cart).toEqual([]);
    else expect(cart[0]?.qty).toBe(expected);
  }
});

it("merges the same configuration and keeps a different one apart", () => {
  const first = line({ name: "Ana", color: "oliva", qty: 2 });
  const same = line({ name: "Ana", color: "oliva", qty: 3 });
  const otherSize = line({ name: "Ana", color: "oliva", size: "grande", qty: 1 });
  const otherName = line({ name: "Luz", color: "oliva", qty: 1 });
  const withCard = line({
    name: "Ana",
    color: "oliva",
    card: { message: "Feliz día" },
    qty: 1,
  });
  expect(addLine([first], same)).toEqual([{ ...same, qty: 5 }]);
  expect(addLine([first], otherSize)).toHaveLength(2);
  expect(addLine([first], otherName)).toHaveLength(2);
  expect(addLine([first], withCard)).toHaveLength(2);
  expect(addLine([line({ qty: 6, stockLeft: 8 })], line({ qty: 6 }))[0]?.qty).toBe(8);
  expect(addLine([], line({ stockLeft: 0 }))).toEqual([]);
  expect(removeLine([first, otherSize], configKey(otherSize))).toEqual([first]);
});

it("drops a stored cart that does not match the schema", () => {
  const valid = [line({ name: "Ñandú 🌷" })];
  expect(parseCart(valid)).toEqual(valid);
  expect(parseCart([{ ...line(), qty: 21 }])).toEqual([]);
  expect(parseCart([{ ...line(), qty: 3, stockLeft: 1 }])).toEqual([]);
  expect(parseCart({ items: valid })).toEqual([]);
  expect(parseStoredCart("not-json")).toEqual([]);
  expect(parseStoredCart(null)).toEqual([]);
  expect(cartFromStorage("other", "[]", valid)).toBe(valid);
  expect(cartFromStorage("gift-shop.cart", "nope", valid)).toEqual([]);
});
