import { useRouter } from "@tanstack/react-router";
import type { AdminOrder, OrderStatus } from "api";
import { useRef, useState } from "react";
import { setAdminStatus } from "../admin.functions";
import { claimSubmit } from "../admin-action";
import { shouldReload, statusMessage, visibleOrder } from "../admin-orders-page";
import {
  deliveryLong,
  deliveryPlace,
  orderTotalCents,
  phoneHref,
  whenInLima,
} from "../admin-present";
import { formatSoles } from "../money";
import { OrderActions } from "./order-actions";
import { SinAcceso } from "./sin-acceso";
import { StatusBadge } from "./status-badge";

export function OrderDetail({ loaded }: { loaded: AdminOrder }) {
  const router = useRouter();
  const sendState = useRef({ sending: false });
  const codeRef = useRef(loaded.code);
  const [sending, setSending] = useState(false);
  const [update, setUpdate] = useState<Awaited<ReturnType<typeof setAdminStatus>> | null>(null);
  const [seenCode, setSeenCode] = useState(loaded.code);
  codeRef.current = loaded.code;

  if (seenCode !== loaded.code) {
    setSeenCode(loaded.code);
    setUpdate(null);
    setSending(false);
    sendState.current = { sending: false };
  }

  if (update?.kind === "denied") return <SinAcceso status={update.status} />;

  const order = visibleOrder(loaded, update);
  const message = statusMessage(update);
  const href = phoneHref(order.customer.phone);
  const total = orderTotalCents(order);

  function send(to: OrderStatus) {
    const claim = claimSubmit(sendState.current);
    sendState.current = { sending: claim.sending };
    if (!claim.claimed) return;
    const requested = codeRef.current;
    setSending(true);
    void setAdminStatus({ data: { code: requested, to } })
      .then(async (result) => {
        if (codeRef.current !== requested) return;
        setUpdate(result);
        if (shouldReload(result)) await router.invalidate();
      })
      .catch(() => {
        if (codeRef.current !== requested) return;
        setUpdate({ kind: "failed" });
      })
      .finally(() => {
        if (codeRef.current !== requested) return;
        sendState.current = { sending: false };
        setSending(false);
      });
  }

  return (
    <article className="stack">
      <header className="detail-head">
        <div>
          <p className="today">{order.code}</p>
          <h1 className="clamp">{order.customer.name}</h1>
        </div>
        <StatusBadge status={order.status} />
      </header>
      {message === null ? null : (
        <p role="alert" className="empty">
          {message}
        </p>
      )}
      <div className="detail-grid">
        <section className="card">
          <h2>Cliente</h2>
          <p className="clamp">{order.customer.name}</p>
          {href === null ? (
            <p>{order.customer.phone}</p>
          ) : (
            <a href={href} rel="noreferrer">
              {order.customer.phone}
            </a>
          )}
          {order.customer.email === null ? null : <p className="clamp">{order.customer.email}</p>}
          <p className="muted">Pedido hecho {whenInLima(order.createdAt)}</p>
        </section>
        <section className="card">
          <h2>Entrega</h2>
          <p className="clamp">{deliveryPlace(order.delivery)}</p>
          <p>{deliveryLong(order.deliveryDate)}</p>
          {order.note === null ? null : <p className="order-note">{order.note}</p>}
        </section>
        <section className="card">
          <h2>Pedido</h2>
          <ul className="plain">
            {order.items.map((item) => (
              <li key={`${item.productName}-${item.lineTotalCents}-${item.qty}`}>
                <b>
                  {item.productName} × {item.qty}
                </b>
                <span className="muted">{item.options.join(" · ")}</span>
                {item.cardMessage === null ? null : (
                  <q className="card-message">{item.cardMessage}</q>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="card capture-card">
          <img
            className="capture"
            src={`/admin/evidencia/${encodeURIComponent(order.code)}`}
            alt={`Captura de Yape de ${order.customer.name}`}
          />
          <div>
            <h2>Pago Yape</h2>
            <p className="stat-money">{formatSoles(total)}</p>
            <p>
              Operación <b>{order.yapeOperation}</b>
            </p>
            {order.deliveryCostCents === null ? (
              <p className="muted">Delivery por coordinar</p>
            ) : null}
          </div>
        </section>
      </div>
      <OrderActions
        status={order.status}
        sending={sending}
        onAdvance={send}
        onReject={() => send("rechazado")}
      />
    </article>
  );
}
