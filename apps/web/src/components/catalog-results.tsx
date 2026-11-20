import type { Occasion, Page, ProductCard } from "api";
import { useRef, useState } from "react";
import { type CatalogSlice, catalogPageState, cursorToLoad, mergeNextPage } from "../catalog-page";
import { listCatalog } from "../products.functions";
import { OccasionFilter } from "./occasion-filter";
import { ProductGrid } from "./product-grid";

export function CatalogResults({
  firstPage,
  occasion,
}: {
  firstPage: Page<ProductCard>;
  occasion: Occasion | undefined;
}) {
  const [extra, setExtra] = useState<CatalogSlice | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seen, setSeen] = useState(occasion);
  const busy = useRef(false);
  const generation = useRef(0);

  if (seen !== occasion) {
    setSeen(occasion);
    setExtra(null);
    setLoading(false);
    setFailed(false);
    busy.current = false;
    generation.current += 1;
  }

  const view = catalogPageState(firstPage, occasion, extra);
  const count =
    view.items.length === 1
      ? "1 regalo listo para personalizar."
      : `${view.items.length} regalos listos para personalizar.`;

  function loadMore() {
    const cursor = cursorToLoad({ loading: busy.current || loading, nextCursor: view.nextCursor });
    if (cursor === null) return;
    const requested = { occasion: view.occasion, cursor };
    const gen = generation.current;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    const data =
      requested.occasion === undefined ? { cursor } : { occasion: requested.occasion, cursor };
    void listCatalog({ data })
      .then((page) => {
        if (generation.current !== gen) return;
        setExtra((current) => {
          const base = catalogPageState(firstPage, occasion, current);
          return mergeNextPage(base, requested, page) ?? current;
        });
      })
      .catch(() => {
        if (generation.current !== gen) return;
        setFailed(true);
      })
      .finally(() => {
        if (generation.current !== gen) return;
        busy.current = false;
        setLoading(false);
      });
  }

  return (
    <>
      <header className="catalog-head">
        <div className="catalog-title">
          <p className="shop-kicker">Hechos a mano, uno por uno</p>
          <h1>Catálogo</h1>
        </div>
        <p className="lede">
          <span className="catalog-count">{count}</span> Elige una ocasión o explóralos todos.
        </p>
      </header>
      <OccasionFilter active={occasion} />
      <ProductGrid products={view.items} />
      {failed ? (
        <p role="alert" className="catalog-alert">
          No pudimos cargar más regalos.
        </p>
      ) : null}
      {view.nextCursor === null ? null : (
        <button
          type="button"
          className="more shop-cta"
          onClick={loadMore}
          disabled={loading}
          aria-busy={loading}
        >
          Ver más
        </button>
      )}
      <aside className="catalog-custom">
        <div>
          <p className="shop-kicker">¿Tienes otra idea en mente?</p>
          <p className="catalog-custom-title">También hago encargos a medida</p>
        </div>
        <a
          className="shop-cta shop-cta-dark"
          href="https://wa.me/51987654321?text=Hola%20%F0%9F%92%9B%20Quiero%20un%20regalo%20a%20medida"
          target="_blank"
          rel="noreferrer"
        >
          Cuéntame por WhatsApp
        </a>
      </aside>
    </>
  );
}
