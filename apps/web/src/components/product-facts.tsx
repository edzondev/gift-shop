import type { ProductCard } from "api";

export function ProductFacts({ product, agotado }: { product: ProductCard; agotado?: boolean }) {
  return (
    <ul className="facts">
      {agotado === true ? <li className="fact-stock">Agotado</li> : null}
      {product.customizable ? <li className="fact-custom">Personalizable</li> : null}
      {product.tag === null ? null : <li className="fact-tag">{product.tag}</li>}
      <li>{`Listo en ${product.prepDays} días`}</li>
      {product.stockLeft === null ? null : (
        <li className="fact-stock">{`Quedan ${product.stockLeft}`}</li>
      )}
    </ul>
  );
}
