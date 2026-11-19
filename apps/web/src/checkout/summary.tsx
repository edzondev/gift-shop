import type { CartLine } from "../cart/logic";
import { cartCount, cartSubtotalCents, configKey } from "../cart/logic";
import { formatSoles } from "../money";
import type { DeliveryDraft } from "./schema";

export function OrderSummary({
  lines,
  delivery,
}: {
  lines: readonly CartLine[];
  delivery: DeliveryDraft;
}) {
  const subtotal = cartSubtotalCents(lines);
  const count = cartCount(lines);
  const deliveryLabel = delivery.mode === "estacion" ? "Gratis" : "Por coordinar";
  return (
    <aside className="summary">
      <h2>Tu pedido</h2>
      <p className="kicker">{count === 1 ? "1 regalo" : `${count} regalos`}</p>
      <ul>
        {lines.map((line) => (
          <li key={configKey(line)}>
            <span>
              {line.productName} × {line.qty}
            </span>
            <b>{formatSoles(line.unitPriceCents * line.qty)}</b>
          </li>
        ))}
      </ul>
      <p>
        <span>Subtotal</span>
        <b>{formatSoles(subtotal)}</b>
      </p>
      <p>
        <span>Entrega</span>
        <b>{deliveryLabel}</b>
      </p>
      <p className="subtotal">
        <span>Total a yapear</span>
        <strong>{formatSoles(subtotal)}</strong>
      </p>
    </aside>
  );
}
