import type { AdminOrder, AdminOrderRow, OrderStatus } from "api";

export type OrdersKey = { status?: OrderStatus; q?: string };

export type OrdersSlice = OrdersKey & {
  items: readonly AdminOrderRow[];
  nextCursor: string | null;
};

export function sameOrdersKey(left: OrdersKey, right: OrdersKey): boolean {
  return left.status === right.status && left.q === right.q;
}

export function ordersPageState(
  first: { items: readonly AdminOrderRow[]; nextCursor: string | null },
  key: OrdersKey,
  extra: OrdersSlice | null,
): OrdersSlice {
  if (extra === null || !sameOrdersKey(extra, key)) {
    return { ...key, items: first.items, nextCursor: first.nextCursor };
  }
  return extra;
}

export function mergeOrdersPage(
  current: OrdersSlice,
  request: OrdersKey & { cursor: string },
  page: { items: readonly AdminOrderRow[]; nextCursor: string | null },
): OrdersSlice | null {
  if (!sameOrdersKey(current, request)) return null;
  if (current.nextCursor !== request.cursor) return null;
  const merged: OrdersSlice = {
    items: [...current.items, ...page.items],
    nextCursor: page.nextCursor,
  };
  if (current.status !== undefined) merged.status = current.status;
  if (current.q !== undefined) merged.q = current.q;
  return merged;
}

export function cursorToLoad(input: {
  loading: boolean;
  nextCursor: string | null;
}): string | null {
  if (input.loading) return null;
  return input.nextCursor;
}

export type StatusUpdate =
  | { kind: "updated"; order: AdminOrder }
  | { kind: "rejected_transition" }
  | { kind: "denied"; status: 401 | 403 }
  | { kind: "failed" };

export function visibleOrder(loaded: AdminOrder, update: StatusUpdate | null): AdminOrder {
  if (update?.kind === "updated") return update.order;
  return loaded;
}

export function shouldReload(update: StatusUpdate): boolean {
  return update.kind === "rejected_transition";
}

export function statusMessage(update: StatusUpdate | null): string | null {
  if (update?.kind === "rejected_transition") {
    return "Ese cambio de estado ya no es válido. Recargamos el pedido.";
  }
  if (update?.kind === "failed") return "No pudimos cambiar el estado. Inténtalo de nuevo.";
  return null;
}
