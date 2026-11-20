import type { OrderStatus } from "api";
import { timelineIndex } from "../labels";

export function thanksLead(status: OrderStatus): string {
  switch (status) {
    case "por_verificar":
      return "está en revisión.";
    case "confirmado":
      return "está confirmado.";
    case "en_preparacion":
      return "se está preparando.";
    case "listo":
      return "está listo.";
    case "entregado":
      return "ya fue entregado.";
    case "rechazado":
      return "no pudo confirmarse.";
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export function rejectedOrder(status: OrderStatus): boolean {
  return status === "rechazado";
}

export function progressStep(status: OrderStatus): number {
  const index = timelineIndex(status);
  if (index < 0) return 0;
  return index;
}

export function giftCount(qty: number): string {
  if (qty === 1) return "1 regalo";
  return `${qty} regalos`;
}
