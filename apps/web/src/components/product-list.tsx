import { Link, Navigate } from "@tanstack/react-router";
import type { AdminProduct, Page } from "api";
import { useRef, useState } from "react";
import { cursorToLoad } from "../admin-orders-page";
import { listAdminProducts } from "../product.functions";
import { appendProducts } from "../product-list-page";
import { ProductRow } from "./product-row";

export function ProductList({ first }: { first: Page<AdminProduct> }) {
  const [extra, setExtra] = useState<Page<AdminProduct> | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const busy = useRef(false);
  const page = extra ?? first;
  if (denied) return <Navigate to="/admin/login" />;

  function loadMore() {
    const cursor = cursorToLoad({ loading: busy.current || loading, nextCursor: page.nextCursor });
    if (cursor === null) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    void listAdminProducts({ data: { cursor } })
      .then((result) => {
        if (result.kind === "denied") {
          setDenied(true);
          return;
        }
        if (result.kind !== "ok") {
          setFailed(true);
          return;
        }
        setExtra((current) => appendProducts(current ?? first, cursor, result.page) ?? current);
      })
      .catch(() => setFailed(true))
      .finally(() => {
        busy.current = false;
        setLoading(false);
      });
  }

  return (
    <div className="stack">
      <header className="list-head">
        <h1>Productos</h1>
        <Link to="/admin/productos/nuevo" className="btn">
          Nuevo producto
        </Link>
      </header>
      {page.items.length === 0 ? <p className="empty">No hay productos.</p> : null}
      <ul className="plain product-list">
        {page.items.map((product) => (
          <ProductRow key={product.id} product={product} onDenied={() => setDenied(true)} />
        ))}
      </ul>
      {failed ? (
        <p role="alert" className="field-error">
          No pudimos cargar más productos.
        </p>
      ) : null}
      {page.nextCursor === null ? null : (
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
