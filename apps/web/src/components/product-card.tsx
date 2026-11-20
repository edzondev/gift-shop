import { Link } from "@tanstack/react-router";
import type { ProductCard as Card } from "api";
import { discountPercent } from "../home/price";
import { PriceRow } from "./price-row";
import { ProductFacts } from "./product-facts";
import { ProductPhoto } from "./product-photo";

export function ProductCard({ product, priority }: { product: Card; priority: boolean }) {
  const off = discountPercent(product.priceCents, product.oldPriceCents);
  return (
    <Link to="/producto/$slug" params={{ slug: product.slug }} className="product-card">
      <span className="product-card-media">
        <ProductPhoto
          photoKey={product.photoKeys[0]}
          label={product.name}
          frame="main"
          priority={priority}
          decorative={false}
        />
        {off === null ? null : <span className="off-pill">{`−${off}%`}</span>}
      </span>
      <ProductFacts product={product} />
      <h2 className="product-card-name">{product.name}</h2>
      <PriceRow cents={product.priceCents} oldCents={product.oldPriceCents} />
    </Link>
  );
}
