export type Gate = { busy: boolean };

export function takeClick(gate: Gate): { gate: Gate; accepted: boolean } {
  if (gate.busy) return { gate, accepted: false };
  return { gate: { busy: true }, accepted: true };
}

export function releaseClick(): Gate {
  return { busy: false };
}

export type StockResult =
  | { type: "stock"; stock: number }
  | { type: "out_of_stock" }
  | { type: "failed" };

const OUT_OF_STOCK = "No hay stock para restar.";
const STOCK_FAILED = "No pudimos cambiar el stock.";

export function applyStock(
  shown: number,
  arrival: { seq: number; latest: number; result: StockResult },
): { stock: number; notice: string | null } {
  if (arrival.seq !== arrival.latest) return { stock: shown, notice: null };
  switch (arrival.result.type) {
    case "stock":
      return { stock: arrival.result.stock, notice: null };
    case "out_of_stock":
      return { stock: shown, notice: OUT_OF_STOCK };
    case "failed":
      return { stock: shown, notice: STOCK_FAILED };
    default: {
      const exhaustive: never = arrival.result;
      return exhaustive;
    }
  }
}

export function canDecrease(stock: number): boolean {
  return stock > 0;
}

export function stockDelta(kind: "minus" | "plus" | "restock"): -1 | 1 | 5 {
  switch (kind) {
    case "minus":
      return -1;
    case "plus":
      return 1;
    case "restock":
      return 5;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
