import { Link } from "@tanstack/react-router";
import type { ProductDetail as Detail } from "api";
import { ProductConfigurator } from "./product-configurator";
import { ProductFacts } from "./product-facts";
import { ProductPhoto } from "./product-photo";

export function ProductDetailView({ product }: { product: Detail }) {
  return (
    <article className="product">
      <p className="crumbs">
        <Link to="/catalogo" search={{ occasion: undefined }}>
          Catálogo
        </Link>
        <span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </p>
      <div className="product-layout">
        <ProductPhoto photoKeys={product.photoKeys} label={product.name} layout="detail" />
        <div className="product-copy">
          <ProductFacts product={product} agotado={!product.inStock} />
          <h1>{product.name}</h1>
          <p className="product-description">{product.description}</p>
          <ProductConfigurator key={product.id} product={product} />
        </div>
      </div>
    </article>
  );
}
