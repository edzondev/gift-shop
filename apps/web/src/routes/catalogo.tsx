import { createFileRoute } from "@tanstack/react-router";
import { catalogSearch } from "../catalog-search";
import { CatalogResults } from "../components/catalog-results";
import { listCatalog } from "../products.functions";
import storeCss from "../store.css?url";

export const Route = createFileRoute("/catalogo")({
  validateSearch: (search: Record<string, unknown>) => catalogSearch(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listCatalog({ data: deps }),
  head: () => ({
    meta: [{ title: "Catálogo" }],
    links: [{ rel: "stylesheet", href: storeCss }],
  }),
  errorComponent: CatalogError,
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const firstPage = Route.useLoaderData();
  return (
    <main className="page">
      <header className="catalog-head">
        <p className="kicker">Hechos a mano, uno por uno</p>
        <h1>Catálogo</h1>
        <p className="lede">Elige una ocasión o explóralos todos.</p>
      </header>
      <CatalogResults firstPage={firstPage} occasion={search.occasion} />
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
