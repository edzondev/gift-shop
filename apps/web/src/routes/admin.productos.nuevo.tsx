import { createFileRoute } from "@tanstack/react-router";
import { ProductEditor } from "../components/product-editor";

export const Route = createFileRoute("/admin/productos/nuevo")({
  head: () => ({
    meta: [{ title: "Nuevo producto" }],
  }),
  component: NewProductPage,
});

function NewProductPage() {
  return <ProductEditor mode="create" loaded={null} note={null} />;
}
