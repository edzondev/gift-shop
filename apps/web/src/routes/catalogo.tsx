import { createFileRoute } from "@tanstack/react-router";
import { catalogSearch } from "../catalog-search";
import { CatalogResults } from "../components/catalog-results";
import { listCatalog } from "../products.functions";
import shopCss from "../shop.css?url";
import storeCss from "../store.css?url";

export const Route = createFileRoute("/catalogo")({
  validateSearch: (search: Record<string, unknown>) => catalogSearch(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listCatalog({ data: deps }),
  head: () => ({
    meta: [{ title: "Catálogo" }],
    links: [
      { rel: "stylesheet", href: storeCss },
      { rel: "stylesheet", href: shopCss },
    ],
  }),
  errorComponent: CatalogError,
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const firstPage = Route.useLoaderData();
  return (
    <main className="shop catalog">
      <div className="shop-wrap">
        <CatalogResults firstPage={firstPage} occasion={search.occasion} />
      </div>
    </main>
  );
}

function CatalogError() {
  return (
    <p role="alert" className="route-error">
      No pudimos cargar el catálogo. Inténtalo de nuevo.
    </p>
  );
}
