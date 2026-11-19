import { Link } from "@tanstack/react-router";
import { colorLabel } from "../labels";
import { formatSoles } from "../money";
import { type CartLine, cartCount, cartSubtotalCents, configKey, maxQty } from "./logic";
import { changeLineQty, removeFromCart, useCart, useCartReady } from "./store";

function optionSummary(line: CartLine): string {
  const parts = [line.size === "grande" ? "Grande" : "Clásica"];
  if (line.name !== undefined) parts.push(line.name);
  if (line.color !== undefined) parts.push(colorLabel(line.color));
  if (line.card !== undefined) parts.push("Tarjeta");
  if (line.wrap === true) parts.push("Envoltura");
  return parts.join(" · ");
}

export function CartView() {
  const ready = useCartReady();
  const lines = useCart();
  if (!ready) return <main className="sheet skeleton" aria-busy="true" />;
  const count = cartCount(lines);
  const subtotal = cartSubtotalCents(lines);
  return (
    <main className="sheet">
      <h1>Tu carrito</h1>
      <p className="kicker">{count === 1 ? "1 regalo" : `${count} regalos`}</p>
      {lines.length === 0 ? (
        <div className="empty">
          <p>Tu carrito está vacío</p>
          <Link to="/catalogo" search={{ occasion: undefined }} className="primary">
            Explorar regalos
          </Link>
        </div>
      ) : (
        <>
          <ul className="cart-list">
            {lines.map((line) => {
              const key = configKey(line);
              const cap = maxQty(line.stockLeft);
              return (
                <li key={key}>
                  <div>
                    <Link to="/producto/$slug" params={{ slug: line.slug }}>
                      {line.productName}
                    </Link>
                    <p>{optionSummary(line)}</p>
                    {line.card !== undefined ? <p>Dedicatoria: {line.card.message}</p> : null}
                  </div>
                  <div className="qty">
                    <button
                      type="button"
                      aria-label={`Menos ${line.productName}`}
                      onClick={() => changeLineQty(key, line.qty - 1)}
                    >
                      −
                    </button>
                    <span>{line.qty}</span>
                    <button
                      type="button"
                      aria-label={`Más ${line.productName}`}
                      disabled={line.qty >= cap}
                      onClick={() => changeLineQty(key, line.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <strong>{formatSoles(line.unitPriceCents * line.qty)}</strong>
                  <button type="button" onClick={() => removeFromCart(key)}>
                    Quitar
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="subtotal">
            <span>Subtotal</span>
            <strong>{formatSoles(subtotal)}</strong>
          </p>
          <p className="hint">La entrega se elige en el siguiente paso. En estación es gratis.</p>
          <Link to="/checkout" className="primary">
            Ir al checkout
          </Link>
        </>
      )}
    </main>
  );
}
