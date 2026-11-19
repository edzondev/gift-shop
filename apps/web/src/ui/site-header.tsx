import { Link, useRouterState } from "@tanstack/react-router";
import { cartCount } from "../cart/logic";
import { useCart } from "../cart/store";

export function SiteHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const count = cartCount(useCart());
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        Taller de Regalos
      </Link>
      <nav className="site-nav">
        <Link to="/catalogo" search={{ occasion: undefined }}>
          Catálogo
        </Link>
        <Link to="/carrito" aria-label={`Carrito, ${count} ${count === 1 ? "regalo" : "regalos"}`}>
          Carrito
          <span className="cart-count">{count}</span>
        </Link>
      </nav>
    </header>
  );
}
