import type { AdminProduct } from "api";
import { useRef, useState } from "react";
import { adjustAdminStock } from "../product.functions";
import {
  applyStock,
  canDecrease,
  type Gate,
  releaseClick,
  stockDelta,
  takeClick,
} from "../product-stock";

function stockResult(result: Awaited<ReturnType<typeof adjustAdminStock>>) {
  switch (result.kind) {
    case "updated":
      return { type: "stock" as const, stock: result.product.stock };
    case "out_of_stock":
      return { type: "out_of_stock" as const };
    default:
      return { type: "failed" as const };
  }
}

export function StockControl({
  id,
  name,
  stock,
  kind,
  onUpdated,
  onDenied,
}: {
  id: string;
  name: string;
  stock: number;
  kind: "step" | "restock";
  onUpdated: (product: AdminProduct) => void;
  onDenied: () => void;
}) {
  const gate = useRef<Gate>({ busy: false });
  const seq = useRef(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function run(delta: -1 | 1 | 5) {
    const click = takeClick(gate.current);
    gate.current = click.gate;
    if (!click.accepted) return;
    const generation = seq.current + 1;
    seq.current = generation;
    setBusy(true);
    void adjustAdminStock({ data: { id, delta } })
      .then((result) => {
        if (seq.current !== generation) return;
        if (result.kind === "denied") {
          onDenied();
          return;
        }
        const applied = applyStock(stock, {
          seq: generation,
          latest: seq.current,
          result: stockResult(result),
        });
        if (result.kind === "updated") onUpdated(result.product);
        setNotice(applied.notice);
      })
      .catch(() => {
        if (seq.current !== generation) return;
        setNotice(
          applyStock(stock, { seq: generation, latest: seq.current, result: { type: "failed" } })
            .notice,
        );
      })
      .finally(() => {
        if (seq.current !== generation) return;
        gate.current = releaseClick();
        setBusy(false);
      });
  }

  return (
    <div className="stock-control">
      {kind === "restock" ? (
        <button
          type="button"
          className="btn btn-small btn-ghost"
          disabled={busy}
          aria-busy={busy}
          onClick={() => run(stockDelta("restock"))}
        >
          +5 unidades
        </button>
      ) : (
        <div className="stepper">
          <button
            type="button"
            className="step"
            aria-label={`Quitar una unidad de ${name}`}
            disabled={busy || !canDecrease(stock)}
            onClick={() => run(stockDelta("minus"))}
          >
            −
          </button>
          <span className="stepper-count">{stock}</span>
          <button
            type="button"
            className="step"
            aria-label={`Sumar una unidad de ${name}`}
            disabled={busy}
            onClick={() => run(stockDelta("plus"))}
          >
            +
          </button>
        </div>
      )}
      {notice === null ? (
        <p className="field-error" />
      ) : (
        <p className="field-error" role="alert">
          {notice}
        </p>
      )}
    </div>
  );
}
