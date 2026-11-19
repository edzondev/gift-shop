import type { ProductCard as Card } from "api";
import { ProductCard } from "./product-card";

export function ProductGrid({ products }: { products: readonly Card[] }) {
  if (products.length === 0) {
    return <p className="catalog-empty">Todavía no hay regalos para esta ocasión.</p>;
  }
  return (
    <ul className="product-grid">
      {products.map((product) => (
        <li key={product.slug}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
