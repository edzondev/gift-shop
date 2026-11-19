import type { OrderStatus } from "api";

const ORDER_STATUSES = [
  "por_verificar",
  "confirmado",
  "en_preparacion",
  "listo",
  "entregado",
  "rechazado",
] as const satisfies readonly OrderStatus[];

export { ORDER_STATUSES };

export type NextAction =
  | { kind: "confirm"; to: "confirmado"; label: "Confirmar pago" }
  | { kind: "advance"; to: "en_preparacion" | "listo" | "entregado"; label: string }
  | { kind: "none" };

export function nextAction(status: OrderStatus): NextAction {
  switch (status) {
    case "por_verificar":
      return { kind: "confirm", to: "confirmado", label: "Confirmar pago" };
    case "confirmado":
      return { kind: "advance", to: "en_preparacion", label: "Marcar en preparación" };
    case "en_preparacion":
      return { kind: "advance", to: "listo", label: "Listo para entrega" };
    case "listo":
      return { kind: "advance", to: "entregado", label: "Marcar entregado" };
    case "entregado":
    case "rechazado":
      return { kind: "none" };
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function canReject(status: OrderStatus): boolean {
  return nextAction(status).kind === "confirm";
}

export function claimSubmit(state: { sending: boolean }): { sending: boolean; claimed: boolean } {
  if (state.sending) return { sending: true, claimed: false };
  return { sending: true, claimed: true };
}

const LABELS = {
  por_verificar: "Pago por verificar",
  confirmado: "Pago verificado",
  en_preparacion: "En preparación",
  listo: "Listo para entrega",
  entregado: "Entregado",
  rechazado: "Rechazado",
} as const satisfies Record<OrderStatus, string>;

export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "por_verificar":
    case "confirmado":
    case "en_preparacion":
    case "listo":
    case "entregado":
    case "rechazado":
      return LABELS[status];
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
