import type { ProductCard as Card } from "api";
import { leadingPhotoIndex } from "../photo";
import { ProductCard } from "./product-card";

export function ProductGrid({ products }: { products: readonly Card[] }) {
  if (products.length === 0) {
    return <p className="catalog-empty">Todavía no hay regalos para esta ocasión.</p>;
  }
  const leading = leadingPhotoIndex(products.map((product) => product.photoKeys.length));
  return (
    <ul className="product-grid">
      {products.map((product, index) => (
        <li key={product.slug}>
          <ProductCard product={product} priority={index === leading} />
        </li>
      ))}
    </ul>
  );
}
