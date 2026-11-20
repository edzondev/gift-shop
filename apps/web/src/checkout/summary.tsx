import type { CartLine } from "../cart/logic";
import { cartCount, cartSubtotalCents, configKey } from "../cart/logic";
import { optionSummary } from "../cart/options";
import { ProductPhoto } from "../components/product-photo";
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
      <ul className="summary-lines">
        {lines.map((line) => (
          <li key={configKey(line)}>
            <ProductPhoto
              photoKey={undefined}
              label={line.productName}
              frame="thumb"
              priority={false}
              decorative
            />
            <span>
              <b>
                {line.productName} × {line.qty}
              </b>
              <span>{optionSummary(line)}</span>
              {line.card !== undefined ? (
                <span className="cart-note">{line.card.message}</span>
              ) : null}
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
