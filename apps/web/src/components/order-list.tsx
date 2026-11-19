import { Link } from "@tanstack/react-router";
import type { AdminOrderRow, Page } from "api";
import { useRef, useState } from "react";
import { listAdminOrders } from "../admin.functions";
import { cursorToLoad, mergeOrdersPage, ordersPageState } from "../admin-orders-page";
import { deliveryPlace, deliveryShort } from "../admin-present";
import type { OrdersRequest } from "../admin-search";
import { ordersKey } from "../admin-search";
import { formatSoles } from "../money";
import { StatusBadge } from "./status-badge";

export function OrderList({ first, query }: { first: Page<AdminOrderRow>; query: OrdersRequest }) {
  const key = ordersKey(query);
  const [extra, setExtra] = useState<ReturnType<typeof ordersPageState> | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seen, setSeen] = useState(key);
  const busy = useRef(false);
  const generation = useRef(0);

  if (seen.status !== key.status || seen.q !== key.q) {
    setSeen(key);
    setExtra(null);
    setLoading(false);
    setFailed(false);
    busy.current = false;
    generation.current += 1;
  }

  const view = ordersPageState(first, key, extra);

  function loadMore() {
    const cursor = cursorToLoad({ loading: busy.current || loading, nextCursor: view.nextCursor });
    if (cursor === null) return;
    const requested = { ...key, cursor };
    const gen = generation.current;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    void listAdminOrders({ data: { ...query, cursor } })
      .then((result) => {
        if (generation.current !== gen) return;
        if (result.kind !== "ok") {
          setFailed(true);
          return;
        }
        setExtra((current) => {
          const base = ordersPageState(first, key, current);
          return mergeOrdersPage(base, requested, result.page) ?? current;
        });
      })
      .catch(() => {
        if (generation.current !== gen) return;
        setFailed(true);
      })
      .finally(() => {
        if (generation.current !== gen) return;
        busy.current = false;
        setLoading(false);
      });
  }

  return (
    <div className="stack">
      <div className="order-head" aria-hidden="true">
        <span>Pedido</span>
        <span>Cliente</span>
        <span>Entrega</span>
        <span>Fecha</span>
        <span>Total</span>
        <span>Estado</span>
      </div>
      {view.items.length === 0 ? <p className="empty">No hay pedidos con este filtro.</p> : null}
      <ul className="plain">
        {view.items.map((order) => (
          <li key={order.code}>
            <Link to="/admin/pedidos/$code" params={{ code: order.code }} className="order-row">
              <b className="order-code">{order.code}</b>
              <span className="order-who">
                <b className="clamp">{order.customerName}</b>
                <span className="clamp muted">{order.itemsShort}</span>
              </span>
              <span className="clamp order-place">{deliveryPlace(order.delivery)}</span>
              <span>{deliveryShort(order.deliveryDate).label}</span>
              <b>{formatSoles(order.totalCents)}</b>
              <StatusBadge status={order.status} />
            </Link>
          </li>
        ))}
      </ul>
      {failed ? <p role="alert">No pudimos cargar más pedidos.</p> : null}
      {view.nextCursor === null ? null : (
        <button
          type="button"
          className="btn more"
          onClick={loadMore}
          disabled={loading}
          aria-busy={loading}
        >
          Ver más
        </button>
      )}
    </div>
  );
}
