import { Link } from "@tanstack/react-router";
import type { ProductDetail } from "api";
import { useState } from "react";
import { canAddGift, lineFromProduct } from "../cart/logic";
import { addToCart } from "../cart/store";
import { formatSoles } from "../money";
import { graphemeCount, limitGraphemes, NAME_LIMIT } from "../name";
import type { GiftColor, GiftSize } from "../order-types";
import { lineTotalCents } from "../price";
import { clampQuantity, quantityCap } from "../quantity";
import { PriceRow } from "./price-row";

const COLORS: readonly { id: GiftColor; label: string; hex: string }[] = [
  { id: "terracota", label: "Terracota", hex: "#c97b5d" },
  { id: "oliva", label: "Oliva", hex: "#8a9a5b" },
  { id: "mostaza", label: "Mostaza", hex: "#e3b448" },
  { id: "rosa_palo", label: "Rosa palo", hex: "#e8b4a6" },
  { id: "crudo", label: "Crudo", hex: "#ede3d1" },
];

const CARD_CENTS = 500;
const WRAP_CENTS = 800;

function has(
  fields: readonly ProductDetail["fields"][number][],
  field: ProductDetail["fields"][number],
) {
  return fields.includes(field);
}

function controlValue(target: unknown): string {
  if (typeof target !== "object" || target === null || !("value" in target)) return "";
  return typeof target.value === "string" ? target.value : "";
}

function savedCents(current: number, previous: number | null): number | null {
  if (previous === null || previous <= current) return null;
  return previous - current;
}

export function ProductConfigurator({ product }: { product: ProductDetail }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<GiftColor>("terracota");
  const [size, setSize] = useState<GiftSize>("clasica");
  const [card, setCard] = useState(false);
  const [message, setMessage] = useState("");
  const [wrap, setWrap] = useState(false);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product.inStock) {
    return (
      <>
        <PriceRow cents={product.priceCents} oldCents={product.oldPriceCents} />
        <div className="sold-out">
          <p className="agotado">Agotado</p>
          <button type="button" className="add-cart" disabled>
            {`Agregar al carrito · ${formatSoles(product.priceCents)}`}
          </button>
        </div>
      </>
    );
  }

  const chosenSize = has(product.fields, "tamano") ? size : "clasica";
  const chosenCard = has(product.fields, "tarjeta") && card;
  const chosenWrap = has(product.fields, "envoltura") && wrap;
  const quantity = clampQuantity(qty, product.stockLeft);
  const cap = quantityCap(product.stockLeft);
  const total = lineTotalCents(
    { priceCents: product.priceCents, largeExtraCents: product.sizes.largeExtraCents },
    { size: chosenSize, card: chosenCard, wrap: chosenWrap },
    quantity,
  );
  const oldTotal = product.oldPriceCents === null ? null : product.oldPriceCents * quantity;
  const saved = savedCents(total, oldTotal);
  const colorName = COLORS.find((item) => item.id === color)?.label ?? "Terracota";
  const ready = canAddGift({
    inStock: product.inStock,
    fields: product.fields,
    name,
    card: chosenCard,
    message,
    quantity,
    stockLeft: product.stockLeft,
  });

  return (
    <>
      <div className="price-line">
        <PriceRow cents={total} oldCents={oldTotal} />
        {saved === null ? null : (
          <span className="save-pill">{`Ahorras ${formatSoles(saved)}`}</span>
        )}
        <p className="total" aria-live="polite">{`Total ${formatSoles(total)}`}</p>
      </div>
      <div className="configurator">
        <div className="configurator-head">
          <p className="shop-kicker">
            {product.customizable ? "Hazlo tuyo ✨" : "Un toque extra ✨"}
          </p>
          <p className="config-note">El total se actualiza al instante</p>
        </div>
        {has(product.fields, "nombre") ? (
          <label className="field" htmlFor="gift-name">
            <span>
              ¿Para quién es?
              <span className="counter">{`${graphemeCount(name)}/${NAME_LIMIT}`}</span>
            </span>
            <input
              id="gift-name"
              value={name}
              placeholder="Escribe el nombre"
              autoComplete="off"
              onChange={(event) =>
                setName(limitGraphemes(controlValue(event.currentTarget), NAME_LIMIT))
              }
            />
          </label>
        ) : null}
        {has(product.fields, "color") ? (
          <fieldset className="field">
            <legend>
              Elige el color <span>{colorName}</span>
            </legend>
            <div className="swatches">
              {COLORS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="swatch"
                  style={{ backgroundColor: item.hex }}
                  aria-label={item.label}
                  aria-pressed={color === item.id}
                  onClick={() => setColor(item.id)}
                />
              ))}
            </div>
          </fieldset>
        ) : null}
        {has(product.fields, "tamano") ? (
          <fieldset className="field">
            <legend>Tamaño</legend>
            <div className="choices">
              <button
                type="button"
                className="choice"
                aria-pressed={chosenSize === "clasica"}
                onClick={() => setSize("clasica")}
              >
                <b>{product.sizes.classic}</b>
                <span className="choice-price">Incluido</span>
              </button>
              <button
                type="button"
                className="choice"
                aria-pressed={chosenSize === "grande"}
                onClick={() => setSize("grande")}
              >
                <b>{product.sizes.large}</b>
                <span className="choice-price">+{formatSoles(product.sizes.largeExtraCents)}</span>
              </button>
            </div>
          </fieldset>
        ) : null}
        {has(product.fields, "tarjeta") || has(product.fields, "envoltura") ? (
          <fieldset className="field">
            <legend>Agrega un detalle</legend>
            {has(product.fields, "tarjeta") ? (
              <button
                type="button"
                className="choice choice-row"
                aria-pressed={chosenCard}
                onClick={() => setCard((on) => !on)}
              >
                <span className="tick" aria-hidden="true" />
                <span className="choice-copy">
                  <b>Tarjeta con dedicatoria</b>
                  <span>La escribo a mano con tu mensaje</span>
                </span>
                <span className="choice-price">+{formatSoles(CARD_CENTS)}</span>
              </button>
            ) : null}
            {has(product.fields, "envoltura") ? (
              <button
                type="button"
                className="choice choice-row"
                aria-pressed={chosenWrap}
                onClick={() => setWrap((on) => !on)}
              >
                <span className="tick" aria-hidden="true" />
                <span className="choice-copy">
                  <b>Envoltura</b>
                  <span>Papel kraft, cinta de lino y ramita seca</span>
                </span>
                <span className="choice-price">+{formatSoles(WRAP_CENTS)}</span>
              </button>
            ) : null}
            {chosenCard ? (
              <label className="field" htmlFor="gift-note">
                Dedicatoria
                <textarea
                  id="gift-note"
                  rows={3}
                  maxLength={200}
                  value={message}
                  placeholder="Escribe tu dedicatoria. Yo la paso a mano ✨"
                  onChange={(event) => setMessage(controlValue(event.currentTarget))}
                />
              </label>
            ) : null}
          </fieldset>
        ) : null}
      </div>
      <div className="purchase">
        <fieldset className="qty" aria-label="Cantidad">
          <button
            type="button"
            aria-label="Menos"
            disabled={quantity <= 1}
            onClick={() => setQty((current) => clampQuantity(current - 1, product.stockLeft))}
          >
            −
          </button>
          <span>{quantity}</span>
          <button
            type="button"
            aria-label="Más"
            disabled={quantity >= cap}
            onClick={() => setQty((current) => clampQuantity(current + 1, product.stockLeft))}
          >
            +
          </button>
        </fieldset>
        <button
          type="button"
          className={added ? "add-cart is-added" : "add-cart"}
          disabled={!ready}
          onClick={() => {
            const line = lineFromProduct(product, {
              name,
              color,
              size: chosenSize,
              card: chosenCard,
              message,
              wrap: chosenWrap,
              qty: quantity,
            });
            if (line === null) return;
            addToCart(line);
            setAdded(true);
          }}
        >
          {added ? "¡Agregado!" : `Agregar al carrito · ${formatSoles(total)}`}
        </button>
      </div>
      {added ? (
        <p className="added" role="status">
          ¡Listo! Tu regalo está en el carrito 🎁 <Link to="/carrito">Ver carrito</Link>
        </p>
      ) : null}
    </>
  );
}
