import { createFileRoute } from "@tanstack/react-router";
import { ProductList } from "../components/product-list";
import { SinAcceso } from "../components/sin-acceso";
import { listAdminProducts } from "../product.functions";

export const Route = createFileRoute("/admin/productos/")({
  loader: () => listAdminProducts({ data: {} }),
  head: () => ({
    meta: [{ title: "Productos" }],
  }),
  errorComponent: ProductsError,
  component: ProductsPage,
});

function ProductsError() {
  return (
    <p role="alert" className="empty">
      No pudimos cargar los productos. Inténtalo de nuevo.
    </p>
  );
}

function ProductsPage() {
  const result = Route.useLoaderData();
  if (result.kind === "denied") return <SinAcceso />;
  if (result.kind !== "ok") return <ProductsError />;
  return <ProductList first={result.page} />;
}
