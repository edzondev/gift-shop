import { Link } from "@tanstack/react-router";
import type { PublicOrder } from "api";
import {
  slotLabel,
  stationLabel,
  statusDetail,
  statusLabel,
  TIMELINE,
  timelineIndex,
} from "../labels";
import { formatSoles } from "../money";

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

export function OrderView({ order }: { order: PublicOrder }) {
  const index = timelineIndex(order.status);
  const total = order.subtotalCents + (order.deliveryCostCents ?? 0);
  return (
    <main className="sheet">
      <p className="kicker">Tu pedido</p>
      <h1>{order.code}</h1>
      <p>
        Estado: <strong>{statusLabel(order.status)}</strong>. {statusDetail(order.status)}
      </p>
      {index < 0 ? null : (
        <ol className="timeline">
          {TIMELINE.map((step, stepIndex) => {
            const state = stepIndex < index ? "done" : stepIndex === index ? "current" : "upcoming";
            return (
              <li key={step} className={state}>
                <span>{stepIndex + 1}</span>
                <strong>{statusLabel(step)}</strong>
                <small>{statusDetail(step)}</small>
              </li>
            );
          })}
        </ol>
      )}
      <section>
        <h2>Regalos</h2>
        <ul className="cart-list">
          {order.items.map((item) => (
            <li key={`${item.productName}-${item.lineTotalCents}-${item.qty}`}>
              <div>
                <strong>
                  {item.productName} × {item.qty}
                </strong>
                <p>{item.options.join(" · ")}</p>
                {item.cardMessage !== null ? <p>Dedicatoria: {item.cardMessage}</p> : null}
              </div>
              <strong>{formatSoles(item.lineTotalCents)}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Entrega</h2>
        <p>{order.delivery.mode === "estacion" ? "Estación del tren" : "Delivery a domicilio"}</p>
        <p>{deliveryText(order)}</p>
        <p>Fecha: {order.deliveryDate}</p>
      </section>
      <section className="summary">
        <p>
          <span>Subtotal</span>
          <b>{formatSoles(order.subtotalCents)}</b>
        </p>
        <p>
          <span>Entrega</span>
          <b>{deliveryCost(order.deliveryCostCents)}</b>
        </p>
        <p className="subtotal">
          <span>Total</span>
          <strong>{formatSoles(total)}</strong>
        </p>
        <p>Operación {order.yapeOperation}</p>
      </section>
      <Link to="/catalogo" search={{ occasion: undefined }}>
        Seguir explorando regalos
      </Link>
    </main>
  );
}
