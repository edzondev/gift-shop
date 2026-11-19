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
  const count = view.items.length === 1 ? "1 regalo" : `${view.items.length} regalos`;

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
      <p className="catalog-count">{count}</p>
      <OccasionFilter active={occasion} />
      <ProductGrid products={view.items} />
      {failed ? <p role="alert">No pudimos cargar más regalos.</p> : null}
      {view.nextCursor === null ? null : (
        <button
          type="button"
          className="more"
          onClick={loadMore}
          disabled={loading}
          aria-busy={loading}
        >
          Ver más
        </button>
      )}
    </>
  );
}
