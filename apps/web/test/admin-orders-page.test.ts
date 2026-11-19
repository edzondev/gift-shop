import { expect, it } from "vitest";
import {
  cursorToLoad,
  mergeOrdersPage,
  ordersPageState,
  shouldReload,
  statusMessage,
  visibleOrder,
} from "../src/admin-orders-page";
import { confirmedOrder, order, row } from "./admin-fixture";

it("drops a page that belongs to another filter or an old cursor", () => {
  const current = { status: "por_verificar" as const, q: "ana", items: [row], nextCursor: "c1" };
  expect(
    mergeOrdersPage(
      current,
      { status: "listo", q: "ana", cursor: "c1" },
      { items: [], nextCursor: null },
    ),
  ).toBeNull();
  expect(
    mergeOrdersPage(
      current,
      { status: "por_verificar", q: "ana", cursor: "viejo" },
      { items: [], nextCursor: null },
    ),
  ).toBeNull();
  const merged = mergeOrdersPage(
    current,
    { status: "por_verificar", q: "ana", cursor: "c1" },
    { items: [{ ...row, code: "REG-2026-0011" }], nextCursor: null },
  );
  expect(merged?.items.map((item) => item.code)).toEqual(["REG-2026-0012", "REG-2026-0011"]);
  expect(merged?.nextCursor).toBeNull();
  expect(cursorToLoad({ loading: true, nextCursor: "c1" })).toBeNull();
  expect(cursorToLoad({ loading: false, nextCursor: "c1" })).toBe("c1");
});

it("forgets accumulated rows when the filter changes", () => {
  const extra = { status: "por_verificar" as const, items: [row], nextCursor: null };
  const view = ordersPageState(
    { items: [{ ...row, code: "REG-2026-0001" }], nextCursor: "n" },
    { status: "entregado" },
    extra,
  );
  expect(view.items.map((item) => item.code)).toEqual(["REG-2026-0001"]);
  expect(view.status).toBe("entregado");
});

it("shows the POST order and reloads only when the transition was rejected", () => {
  const fresh = confirmedOrder();
  expect(visibleOrder(order, { kind: "updated", order: fresh })).toBe(fresh);
  expect(visibleOrder(order, { kind: "rejected_transition" })).toBe(order);
  expect(visibleOrder(order, null)).toBe(order);
  expect(shouldReload({ kind: "rejected_transition" })).toBe(true);
  expect(shouldReload({ kind: "updated", order: fresh })).toBe(false);
  expect(shouldReload({ kind: "failed" })).toBe(false);
  expect(shouldReload({ kind: "denied" })).toBe(false);
  expect(statusMessage({ kind: "rejected_transition" })).toContain("ya no es válido");
  expect(statusMessage({ kind: "updated", order: fresh })).toBeNull();
});
