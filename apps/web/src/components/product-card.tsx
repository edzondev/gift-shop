import { Link } from "@tanstack/react-router";
import type { ProductCard as Card } from "api";
import { PriceRow } from "./price-row";
import { ProductFacts } from "./product-facts";
import { ProductPhoto } from "./product-photo";

export function ProductCard({ product, priority }: { product: Card; priority: boolean }) {
  return (
    <Link to="/producto/$slug" params={{ slug: product.slug }} className="product-card">
      <ProductPhoto
        photoKey={product.photoKeys[0]}
        label={product.name}
        frame="main"
        priority={priority}
        decorative
      />
      <ProductFacts product={product} />
      <h2 className="product-card-name">{product.name}</h2>
      <PriceRow cents={product.priceCents} oldCents={product.oldPriceCents} />
    </Link>
  );
}
