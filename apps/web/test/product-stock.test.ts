import { expect, it } from "vitest";
import { appendProducts } from "../src/product-list-page";
import { applyStock, canDecrease, stockDelta, takeClick } from "../src/product-stock";

it("sends one request when the action is already in flight", () => {
  const first = takeClick({ busy: false });
  const second = takeClick(first.gate);
  expect(first.accepted).toBe(true);
  expect(second.accepted).toBe(false);
});

it("shows the stock from the latest response", () => {
  const first = applyStock(1, { seq: 1, latest: 2, result: { type: "stock", stock: 2 } });
  const latest = applyStock(first.stock, {
    seq: 2,
    latest: 2,
    result: { type: "stock", stock: 4 },
  });
  const late = applyStock(latest.stock, { seq: 1, latest: 2, result: { type: "stock", stock: 2 } });
  expect(first.stock).toBe(1);
  expect(latest.stock).toBe(4);
  expect(late.stock).toBe(4);
  expect(late.notice).toBeNull();
});

it("keeps the number when the result would go below zero", () => {
  const applied = applyStock(0, { seq: 1, latest: 1, result: { type: "out_of_stock" } });
  expect(applied.stock).toBe(0);
  expect(applied.notice).toMatch(/stock/i);
  expect(canDecrease(0)).toBe(false);
  expect(canDecrease(1)).toBe(true);
});

it("uses plus one, minus one, and plus five", () => {
  expect(stockDelta("minus")).toBe(-1);
  expect(stockDelta("plus")).toBe(1);
  expect(stockDelta("restock")).toBe(5);
});

it("ignores a page that is not the cursor still on screen", () => {
  const current = { items: [{ id: "a" }], nextCursor: "cursor-1" };
  expect(
    appendProducts(current, "cursor-2", { items: [{ id: "b" }], nextCursor: null }),
  ).toBeNull();
  expect(appendProducts(current, "cursor-1", { items: [{ id: "b" }], nextCursor: null })).toEqual({
    items: [{ id: "a" }, { id: "b" }],
    nextCursor: null,
  });
});
