import { expect, it } from "vitest";
import { clampQuantity, quantityCap } from "../src/quantity";

it("keeps quantity between 1 and 20, and within stockLeft", () => {
  expect(quantityCap(null)).toBe(20);
  expect(quantityCap(2)).toBe(2);
  expect(quantityCap(50)).toBe(20);
  expect(quantityCap(0)).toBe(0);
  expect(clampQuantity(0, 8)).toBe(1);
  expect(clampQuantity(3, null)).toBe(3);
  expect(clampQuantity(21, null)).toBe(20);
  expect(clampQuantity(5, 2)).toBe(2);
  expect(clampQuantity(1, 1)).toBe(1);
});
