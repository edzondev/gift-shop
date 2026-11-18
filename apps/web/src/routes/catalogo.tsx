import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [{ title: "Catálogo" }],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  return <h1>Catálogo</h1>;
}
