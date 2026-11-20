import { Link } from "@tanstack/react-router";
import type { PublicOrder } from "api";
import { ProductPhoto } from "../components/product-photo";
import {
  slotLabel,
  stationLabel,
  statusDetail,
  statusLabel,
  TIMELINE,
  timelineIndex,
} from "../labels";
import { formatSoles } from "../money";
import { giftCount, progressStep, rejectedOrder, thanksLead } from "./copy";

function deliveryText(order: PublicOrder): string {
  switch (order.delivery.mode) {
    case "estacion":
      return `${stationLabel(order.delivery.station)} · ${slotLabel(order.delivery.slot)}`;
    case "delivery": {
      const reference =
        order.delivery.reference !== undefined ? ` · ${order.delivery.reference}` : "";
      return `${order.delivery.address}, ${order.delivery.district}${reference}`;
    }
    default: {
      const neverDelivery: never = order.delivery;
      return neverDelivery;
    }
  }
}

function deliveryCost(cents: number | null): string {
  if (cents === null) return "por coordinar";
  if (cents === 0) return "Gratis";
  return formatSoles(cents);
}

function stepMark(index: number, stepIndex: number): "done" | "current" | "upcoming" {
  if (index < 0 || stepIndex > index) return "upcoming";
  if (stepIndex < index) return "done";
  return "current";
}

export function OrderView({ order }: { order: PublicOrder }) {
  const index = timelineIndex(order.status);
  const rejected = rejectedOrder(order.status);
  const step = progressStep(order.status);
  const total = order.subtotalCents + (order.deliveryCostCents ?? 0);
  const count = order.items.reduce((sum, item) => sum + item.qty, 0);
  const place = order.delivery.mode === "estacion" ? "Estación del tren" : "Delivery a domicilio";
  return (
    <main className="shop order-page">
      <div className="shop-wrap">
        <header className="order-hero">
          <span className="order-gift" aria-hidden="true">
            <GiftIcon />
          </span>
          <h1>¡Gracias!</h1>
          <p className="order-lead">
            Tu pedido <span className="order-code">{order.code}</span> {thanksLead(order.status)}
          </p>
          <p className="order-detail">{statusDetail(order.status)}</p>
        </header>
        <section className="order-status">
          <h2>Estado de tu pedido</h2>
          {rejected ? (
            <p className="order-rejected" role="status">
              {statusLabel(order.status)}. {statusDetail(order.status)}
            </p>
          ) : null}
          <div
            className="timeline-wrap"
            data-step={String(step)}
            data-rejected={rejected ? "true" : "false"}
          >
            <span className="timeline-track" aria-hidden="true">
              <span className="timeline-fill" />
            </span>
            <ol className="timeline">
              {TIMELINE.map((status, stepIndex) => {
                const state = stepMark(index, stepIndex);
                return (
                  <li
                    key={status}
                    className={`timeline-${state}`}
                    aria-current={state === "current" ? "step" : undefined}
                  >
                    <span className="timeline-mark">{state === "done" ? "✓" : stepIndex + 1}</span>
                    <strong>{statusLabel(status)}</strong>
                    <small>{statusDetail(status)}</small>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
        <div className="order-facts">
          <article>
            <span>Entrega</span>
            <b>{place}</b>
            <p>{deliveryText(order)}</p>
            <p>Fecha: {order.deliveryDate}</p>
          </article>
          <article>
            <span>Pago con Yape</span>
            <b>{formatSoles(total)}</b>
            <p>Operación {order.yapeOperation}</p>
            <p>Entrega {deliveryCost(order.deliveryCostCents)}</p>
          </article>
          <article>
            <span>Tus regalos</span>
            <b>{giftCount(count)}</b>
            <p>{order.items.map((item) => item.productName).join(", ")}</p>
          </article>
        </div>
        <ul className="cart-list">
          {order.items.map((item) => (
            <li key={`${item.productName}-${item.lineTotalCents}-${item.qty}`}>
              <ProductPhoto
                photoKey={undefined}
                label={item.productName}
                frame="thumb"
                priority={false}
                decorative
              />
              <div>
                <strong>
                  {item.productName} × {item.qty}
                </strong>
                <p>{item.options.join(" · ")}</p>
                {item.cardMessage !== null ? <p className="cart-note">{item.cardMessage}</p> : null}
              </div>
              <strong>{formatSoles(item.lineTotalCents)}</strong>
            </li>
          ))}
        </ul>
        <p className="order-money">
          <span>Subtotal</span>
          <b>{formatSoles(order.subtotalCents)}</b>
        </p>
        <p className="order-money">
          <span>Entrega</span>
          <b>{deliveryCost(order.deliveryCostCents)}</b>
        </p>
        <p className="order-money order-sum">
          <span>Total</span>
          <strong>{formatSoles(total)}</strong>
        </p>
        <Link to="/catalogo" search={{ occasion: undefined }} className="order-more">
          Seguir explorando regalos
        </Link>
      </div>
    </main>
  );
}

function GiftIcon() {
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1A1A1A"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="8" width="17" height="4.5" rx="1.2" />
      <path d="M5 12.5V20h14v-7.5M12 8v12" />
      <path d="M12 8C10.6 5 7 4.6 7 6.8 7 8 9 8 12 8zm0 0c1.4-3 5-3.4 5-1.2C17 8 15 8 12 8z" />
    </svg>
  );
}
