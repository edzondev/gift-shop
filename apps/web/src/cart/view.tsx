import { Link } from "@tanstack/react-router";
import { ProductPhoto } from "../components/product-photo";
import { formatSoles } from "../money";
import { type CartLine, cartCount, cartSubtotalCents, configKey, maxQty } from "./logic";
import { optionSummary } from "./options";
import { changeLineQty, removeFromCart, useCart, useCartReady } from "./store";

function giftLabel(count: number): string {
  if (count === 1) return "1 regalo";
  return `${count} regalos`;
}

export function CartView() {
  const ready = useCartReady();
  const lines = useCart();
  if (!ready) return <main className="shop cart-page skeleton" aria-busy="true" />;
  const count = cartCount(lines);
  const subtotal = cartSubtotalCents(lines);
  return (
    <main className="shop cart-page">
      <div className="shop-wrap">
        <header className="cart-head">
          <h1>Tu carrito</h1>
          <p className="shop-kicker">{giftLabel(count)}</p>
        </header>
        {lines.length === 0 ? (
          <div className="cart-empty">
            <p>Tu carrito está vacío</p>
            <p className="shop-kicker">por ahora ✨</p>
            <Link to="/catalogo" search={{ occasion: undefined }} className="shop-cta">
              Explorar regalos
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <ul className="cart-list">
              {lines.map((line) => (
                <CartRow key={configKey(line)} line={line} />
              ))}
            </ul>
            <aside className="cart-side">
              <p className="cart-total">
                <span>Total</span>
                <strong>{formatSoles(subtotal)}</strong>
              </p>
              <p className="hint">
                La entrega se elige en el siguiente paso. En estación es gratis.
              </p>
              <Link to="/checkout" className="shop-cta">
                Ir al checkout
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function CartRow({ line }: { line: CartLine }) {
  const key = configKey(line);
  const cap = maxQty(line.stockLeft);
  return (
    <li className="cart-row">
      <ProductPhoto
        photoKey={undefined}
        label={line.productName}
        frame="thumb"
        priority={false}
        decorative
      />
      <div className="cart-copy">
        <Link to="/producto/$slug" params={{ slug: line.slug }} className="cart-name">
          {line.productName}
        </Link>
        <p>{optionSummary(line)}</p>
        {line.card !== undefined ? <p className="cart-note">{line.card.message}</p> : null}
        <div className="cart-meta">
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
        </div>
      </div>
      <button type="button" className="cart-remove" onClick={() => removeFromCart(key)}>
        Quitar
      </button>
    </li>
  );
}
