import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { ProductEditor } from "../components/product-editor";
import { SinAcceso } from "../components/sin-acceso";
import { getAdminProduct } from "../product.functions";
import { avisoText, productAviso } from "../product-search";

export const Route = createFileRoute("/admin/productos/$id")({
  validateSearch: (search: Record<string, unknown>) => productAviso(search),
  loader: async ({ params }) => {
    const result = await getAdminProduct({ data: params.id });
    if (result.kind === "missing") throw notFound();
    if (result.kind === "denied" && result.status === 401) throw redirect({ to: "/admin/login" });
    return result;
  },
  head: () => ({
    meta: [{ title: "Editar producto" }],
  }),
  errorComponent: ProductError,
  component: EditProductPage,
});

function ProductError() {
  return (
    <p role="alert" className="empty">
      No pudimos cargar el producto. Inténtalo de nuevo.
    </p>
  );
}

function EditProductPage() {
  const result = Route.useLoaderData();
  const search = Route.useSearch();
  if (result.kind === "denied") return <SinAcceso status={result.status} />;
  if (result.kind !== "ok") return <ProductError />;
  return <ProductEditor mode="edit" loaded={result.product} note={avisoText(search.aviso)} />;
}
