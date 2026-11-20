import { Link, useRouterState } from "@tanstack/react-router";
import { cartCount } from "../cart/logic";
import { useCart } from "../cart/store";
import { isAdminPath } from "../store-path";

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 8.5h14l-1.1 11a1.5 1.5 0 0 1-1.5 1.4H7.6a1.5 1.5 0 0 1-1.5-1.4L5 8.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.5V7a3 3 0 0 1 6 0v1.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const count = cartCount(useCart());
  if (isAdminPath(pathname)) return null;
  const catalogOn = pathname === "/catalogo" || pathname.startsWith("/producto/");
  const noun = count === 1 ? "regalo" : "regalos";
  return (
    <header className="site-header">
      <div className="site-header-bar">
        <Link to="/" className="store-brand">
          <span className="store-brand-name">Taller de Regalos</span>
          <span className="store-brand-hand">hecho a mano</span>
        </Link>
        <nav className="site-nav" aria-label="Tienda">
          <Link
            to="/catalogo"
            search={{ occasion: undefined }}
            aria-current={catalogOn ? "page" : undefined}
          >
            Catálogo
          </Link>
          <Link to="/" hash="como" activeOptions={{ exact: true, includeHash: true }}>
            Cómo funciona
          </Link>
        </nav>
        <Link to="/carrito" className="cart-link" aria-label={`Carrito, ${count} ${noun}`}>
          <CartIcon />
          <span className="cart-label">Carrito</span>
          <span className="cart-count">{count}</span>
        </Link>
      </div>
    </header>
  );
}
