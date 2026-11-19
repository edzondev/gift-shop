import type { OrderStatus } from "api";
import { expect, it } from "vitest";
import { canReject, claimSubmit, nextAction, ORDER_STATUSES } from "../src/admin-action";

const expected = {
  por_verificar: { kind: "confirm", to: "confirmado", label: "Confirmar pago" },
  confirmado: { kind: "advance", to: "en_preparacion", label: "Marcar en preparación" },
  en_preparacion: { kind: "advance", to: "listo", label: "Listo para entrega" },
  listo: { kind: "advance", to: "entregado", label: "Marcar entregado" },
  entregado: { kind: "none" },
  rechazado: { kind: "none" },
} satisfies Record<OrderStatus, ReturnType<typeof nextAction>>;

it("chooses only the next step for every status", () => {
  for (const status of ORDER_STATUSES) {
    expect(nextAction(status)).toEqual(expected[status]);
    expect(canReject(status)).toBe(status === "por_verificar");
  }
});

it("lets the first click through and drops the next while it is sending", () => {
  let state = { sending: false };
  const first = claimSubmit(state);
  state = { sending: first.sending };
  const second = claimSubmit(state);
  expect(first).toEqual({ sending: true, claimed: true });
  expect(second).toEqual({ sending: true, claimed: false });
});
