import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProductDetailView } from "../components/product-detail";
import productCss from "../product.css?url";
import { getProduct } from "../products.functions";
import shopCss from "../shop.css?url";
import storeCss from "../store.css?url";

export const Route = createFileRoute("/producto/$slug")({
  loader: async ({ params }) => {
    const lookup = await getProduct({ data: params.slug });
    if (lookup.kind === "missing") throw notFound();
    return lookup.product;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData === undefined ? "Producto" : loaderData.name }],
    links: [
      { rel: "stylesheet", href: storeCss },
      { rel: "stylesheet", href: productCss },
      { rel: "stylesheet", href: shopCss },
    ],
  }),
  errorComponent: ProductError,
  component: ProductPage,
});

function ProductPage() {
  const product = Route.useLoaderData();
  return (
    <main className="shop">
      <div className="shop-wrap">
        <ProductDetailView product={product} />
      </div>
    </main>
  );
}

function ProductError() {
  return (
    <p role="alert" className="route-error">
      No pudimos cargar el producto. Inténtalo de nuevo.
    </p>
  );
}
