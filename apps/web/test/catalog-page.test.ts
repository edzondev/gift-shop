import type { ProductCard } from "api";
import { expect, it } from "vitest";
import { catalogPageState, cursorToLoad, mergeNextPage } from "../src/catalog-page";

function card(slug: string): ProductCard {
  return {
    slug,
    name: slug,
    priceCents: 1000,
    oldPriceCents: null,
    tag: null,
    occasions: ["cumple"],
    prepDays: 1,
    photoKeys: [],
    customizable: false,
    stockLeft: null,
  };
}

const first = card("primero");
const second = card("segundo");
const mama = card("mama");

it("loads the cursor from the current page and ignores a stale one", () => {
  expect(cursorToLoad({ loading: true, nextCursor: "c1" })).toBeNull();
  expect(cursorToLoad({ loading: false, nextCursor: "c1" })).toBe("c1");
  expect(cursorToLoad({ loading: false, nextCursor: null })).toBeNull();

  const current = { occasion: "cumple" as const, items: [first], nextCursor: "c1" };
  expect(
    mergeNextPage(
      current,
      { occasion: "cumple", cursor: "old" },
      { items: [second], nextCursor: null },
    ),
  ).toBeNull();
  const merged = mergeNextPage(
    current,
    { occasion: "cumple", cursor: "c1" },
    { items: [second], nextCursor: null },
  );
  expect(merged?.items.map((item) => item.slug)).toEqual(["primero", "segundo"]);
  expect(merged?.nextCursor).toBeNull();
});

it("drops accumulated pages when the occasion changes", () => {
  const extra = { occasion: "cumple" as const, items: [first, second], nextCursor: null };
  const view = catalogPageState({ items: [mama], nextCursor: "n" }, "mama", extra);
  expect(view.items.map((item) => item.slug)).toEqual(["mama"]);
  expect(view.nextCursor).toBe("n");
  expect(view.occasion).toBe("mama");
});
