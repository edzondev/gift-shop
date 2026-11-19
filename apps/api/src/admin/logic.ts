import type { OrderStatus } from "../types";

const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  por_verificar: ["confirmado", "rechazado"],
  confirmado: ["en_preparacion"],
  en_preparacion: ["listo"],
  listo: ["entregado"],
  entregado: [],
  rechazado: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

export function itemsShort(items: readonly { name: string; qty: number }[]): string {
  return items.map((item) => (item.qty === 1 ? item.name : `${item.name} ×${item.qty}`)).join(", ");
}

export function likeContains(value: string): string {
  const escaped = value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  return `%${escaped}%`;
}

export function containsNonAscii(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) > 127) return true;
  }
  return false;
}

export function dayStart(day: string): string {
  return `${day}T00:00:00.000-05:00`;
}
