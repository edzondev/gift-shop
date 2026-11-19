export function prepDaysLabel(days: number): string {
  const noun = days === 1 ? "día" : "días";
  return `Listo en ${days} ${noun}`;
}

export type StockNotice =
  | { kind: "hidden" }
  | { kind: "agotado" }
  | { kind: "left"; count: number };

export function stockNotice(stockLeft: number | null): StockNotice {
  if (stockLeft === null) return { kind: "hidden" };
  if (stockLeft === 0) return { kind: "agotado" };
  return { kind: "left", count: stockLeft };
}
