import { expect, it } from "vitest";
import { ordersInput, ordersRequest, ordersSearch } from "../src/admin-search";

it("drops an invalid status and keeps accents, emoji and extra spaces for the field", () => {
  expect(ordersSearch({})).toEqual({});
  expect(ordersSearch({ status: "xyz", q: 1, cursor: "no" })).toEqual({});
  expect(ordersSearch({ status: "por_verificar", q: "" })).toEqual({ status: "por_verificar" });
  expect(ordersSearch({ q: "   " })).toEqual({ q: "   " });
  expect(ordersSearch({ q: "  ñandú 🎁  " })).toEqual({ q: "  ñandú 🎁  " });
  expect(ordersSearch({ status: "ENTREGADO" })).toEqual({});
});

it("trims the query sent to the API and ignores a blank or invalid cursor", () => {
  expect(ordersRequest({ q: "  ñandú 🎁  ", cursor: "" })).toEqual({ q: "ñandú 🎁" });
  expect(ordersRequest({ q: "   " })).toEqual({});
  expect(ordersRequest({ status: "listo", cursor: "abc" })).toEqual({
    status: "listo",
    cursor: "abc",
  });
  expect(ordersInput({ status: "no-existe", q: "  Ana  ", cursor: 4 })).toEqual({ q: "Ana" });
  expect(ordersInput("no")).toEqual({});
  expect(ordersInput({ status: "rechazado", q: "REG-2026-0001" })).toEqual({
    status: "rechazado",
    q: "REG-2026-0001",
  });
});
