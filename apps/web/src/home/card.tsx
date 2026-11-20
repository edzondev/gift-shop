import { Link } from "@tanstack/react-router";
import type { ProductCard } from "api";
import { ProductPhoto } from "../components/product-photo";
import { stockNotice } from "../facts";
import { formatSoles } from "../money";
import { discountPercent } from "./price";

function HomePrice({ cents, oldCents }: { cents: number; oldCents: number | null }) {
  return (
    <p className="home-price">
      <span>{formatSoles(cents)}</span>
      {oldCents === null ? null : <s>{formatSoles(oldCents)}</s>}
    </p>
  );
}

function CardBadges({ product, off }: { product: ProductCard; off: number | null }) {
  const stock = stockNotice(product.stockLeft);
  return (
    <span className="home-badges">
      {product.tag === null ? null : (
        <span className="home-badge home-badge-tag">{product.tag}</span>
      )}
      {off === null ? null : <span className="home-off">{`−${off}%`}</span>}
      {stock.kind === "left" ? (
        <span className="home-badge home-badge-stock">{`¡Quedan ${stock.count}!`}</span>
      ) : null}
      {stock.kind === "agotado" ? (
        <span className="home-badge home-badge-stock">Agotado</span>
      ) : null}
      {product.customizable ? (
        <span className="home-badge home-badge-custom">Personalizable</span>
      ) : null}
    </span>
  );
}

export function HomeCard({ product, priority }: { product: ProductCard; priority: boolean }) {
  const off = discountPercent(product.priceCents, product.oldPriceCents);
  return (
    <li className="home-card">
      <Link to="/producto/$slug" params={{ slug: product.slug }} className="home-card-link">
        <span className="home-card-media">
          <ProductPhoto
            photoKey={product.photoKeys[0]}
            label={product.name}
            frame="main"
            priority={priority}
            decorative={false}
          />
          <CardBadges product={product} off={off} />
        </span>
        <span className="home-card-name">{product.name}</span>
        <HomePrice cents={product.priceCents} oldCents={product.oldPriceCents} />
      </Link>
    </li>
  );
}
