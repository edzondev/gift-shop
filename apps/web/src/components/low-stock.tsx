import type { AdminSummary } from "api";
import { useState } from "react";
import { SinAcceso } from "./sin-acceso";
import { StockControl } from "./stock-control";

export function LowStock({ items }: { items: AdminSummary["lowStock"] }) {
  const [stocks, setStocks] = useState<Readonly<Record<string, number>>>({});
  const [denied, setDenied] = useState(false);
  if (denied) return <SinAcceso />;
  if (items.length === 0) return <p className="muted">El stock está bien.</p>;
  return (
    <ul className="plain">
      {items.map((item) => {
        const stock = stocks[item.id] ?? item.stock;
        return (
          <li key={item.id} className="stock-row">
            <span>
              <b className="clamp">{item.name}</b>
              <span className="low">Quedan {stock}</span>
            </span>
            <StockControl
              id={item.id}
              name={item.name}
              stock={stock}
              kind="restock"
              onUpdated={(product) =>
                setStocks((current) => ({ ...current, [product.id]: product.stock }))
              }
              onDenied={() => setDenied(true)}
            />
          </li>
        );
      })}
    </ul>
  );
}
