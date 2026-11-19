import { expect, it } from "vitest";
import type { GiftSize } from "../src/order-types";
import { lineTotalCents, unitPriceCents } from "../src/price";

const product = { priceCents: 4500, largeExtraCents: 1500 };
const sizes = ["clasica", "grande"] satisfies readonly GiftSize[];
const flags = [false, true];

it("matches every size, card and wrap combination", () => {
  for (const size of sizes) {
    for (const card of flags) {
      for (const wrap of flags) {
        let expected = product.priceCents;
        if (size === "grande") expected += product.largeExtraCents;
        if (card) expected += 500;
        if (wrap) expected += 800;
        const choices = { size, card, wrap };
        expect(unitPriceCents(product, choices)).toBe(expected);
        expect(lineTotalCents(product, choices, 1)).toBe(expected);
        expect(lineTotalCents(product, choices, 4)).toBe(expected * 4);
      }
    }
  }
});
