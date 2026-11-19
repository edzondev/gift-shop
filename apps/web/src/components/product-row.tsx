import { Link } from "@tanstack/react-router";
import type { AdminProduct } from "api";
import { useRef, useState } from "react";
import { formatSoles } from "../money";
import { setProductActive } from "../product.functions";
import { type Gate, releaseClick, takeClick } from "../product-stock";
import { ProductPhoto } from "./product-photo";
import { StockControl } from "./stock-control";

export function ProductRow({ product, onDenied }: { product: AdminProduct; onDenied: () => void }) {
  const gate = useRef<Gate>({ busy: false });
  const [current, setCurrent] = useState(product);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  if (current.id !== product.id) setCurrent(product);
  if (missing) return <li className="product-row">Ese producto ya no está.</li>;

  const photo = current.photos[0];

  function toggle() {
    const click = takeClick(gate.current);
    gate.current = click.gate;
    if (!click.accepted) return;
    setBusy(true);
    void setProductActive({ data: { id: current.id, active: !current.active } })
      .then((result) => {
        if (result.kind === "saved") setCurrent(result.product);
        else if (result.kind === "denied") onDenied();
        else if (result.kind === "missing") setMissing(true);
      })
      .finally(() => {
        gate.current = releaseClick();
        setBusy(false);
      });
  }

  return (
    <li className={current.active ? "product-row" : "product-row product-hidden"}>
      <ProductPhoto
        photoKey={photo?.key}
        label={current.name}
        frame="thumb"
        priority={false}
        decorative={false}
      />
      <div className="product-main">
        <div className="product-title">
          <span>
            <b className="clamp">{current.name}</b>
            <span>
              <b>{formatSoles(current.priceCents)}</b>
              {current.oldPriceCents === null ? null : (
                <s className="muted"> {formatSoles(current.oldPriceCents)}</s>
              )}
            </span>
          </span>
          <button
            type="button"
            className="visibility"
            aria-pressed={current.active}
            disabled={busy}
            onClick={toggle}
          >
            {current.active ? "Visible" : "Oculto"}
          </button>
        </div>
        <div className="product-actions">
          <StockControl
            id={current.id}
            name={current.name}
            stock={current.stock}
            kind="step"
            onUpdated={setCurrent}
            onDenied={onDenied}
          />
          {current.stock <= 3 ? <span className="low">Stock bajo</span> : null}
          <Link
            to="/admin/productos/$id"
            params={{ id: current.id }}
            className="btn btn-small btn-ghost"
          >
            Editar
          </Link>
        </div>
      </div>
    </li>
  );
}
