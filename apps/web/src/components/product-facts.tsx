import type { ProductCard } from "api";
import { prepDaysLabel, stockNotice } from "../facts";

export function ProductFacts({ product, agotado }: { product: ProductCard; agotado?: boolean }) {
  const stock = stockNotice(product.stockLeft);
  const soldOut = agotado === true || stock.kind === "agotado";
  return (
    <ul className="facts">
      {soldOut ? <li className="fact-stock">Agotado</li> : null}
      {product.customizable ? <li className="fact-custom">Personalizable</li> : null}
      {product.tag === null ? null : <li className="fact-tag">{product.tag}</li>}
      <li>{prepDaysLabel(product.prepDays)}</li>
      {stock.kind === "left" ? <li className="fact-stock">{`Quedan ${stock.count}`}</li> : null}
    </ul>
  );
}
