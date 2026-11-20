import { Link } from "@tanstack/react-router";
import type { ProductCard } from "api";
import { ProductPhoto } from "../components/product-photo";
import { type FeaturedShelf, spotlightOf } from "../featured-shelf";
import { formatSoles } from "../money";
import { ArrowIcon } from "./arrow";

function HeroMedia({ product }: { product: ProductCard | null }) {
  if (product === null) return null;
  const photoKey = product.photoKeys[0];
  if (photoKey === undefined) return null;
  return (
    <div className="hero-media">
      <ProductPhoto
        photoKey={photoKey}
        label={product.name}
        frame="main"
        priority
        decorative
        cover
      />
    </div>
  );
}

function HeroPill({ product }: { product: ProductCard | null }) {
  return (
    <span className="hero-pill">
      {product === null ? null : (
        <ProductPhoto
          photoKey={product.photoKeys[0]}
          label={product.name}
          frame="main"
          priority={false}
          decorative
        />
      )}
    </span>
  );
}

function HeroSpotlight({ product }: { product: ProductCard | null }) {
  if (product === null) {
    return (
      <Link to="/catalogo" search={{ occasion: undefined }} className="hero-spot hero-spot-empty">
        <span className="hero-spot-copy">
          <span className="hero-spot-kicker">Hecho a mano</span>
          <span className="hero-spot-name">El catálogo abre pronto</span>
          <span className="hero-spot-meta">Cuando haya piezas nuevas, las vas a ver aquí.</span>
        </span>
      </Link>
    );
  }
  const detail = product.customizable ? " · Personalizable" : "";
  return (
    <Link to="/producto/$slug" params={{ slug: product.slug }} className="hero-spot">
      <span className="hero-spot-photo">
        <ProductPhoto
          photoKey={product.photoKeys[0]}
          label={product.name}
          frame="main"
          priority={false}
          decorative={false}
        />
      </span>
      <span className="hero-spot-copy">
        <span className="hero-spot-kicker">El más pedido</span>
        <span className="hero-spot-name">{product.name}</span>
        <span className="hero-spot-meta">{`Desde ${formatSoles(product.priceCents)}${detail}`}</span>
      </span>
    </Link>
  );
}

function HeroSeal() {
  return (
    <div className="hero-seal" aria-hidden="true">
      <svg className="hero-seal-spin" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <path id="home-seal" d="M50,50 m-39,0 a39,39 0 1,1 78,0 a39,39 0 1,1 -78,0" />
        </defs>
        <text>
          <textPath href="#home-seal">HECHO A MANO · CON INTENCIÓN · A TIEMPO ·</textPath>
        </text>
      </svg>
      <span className="hero-seal-badge">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"
            stroke="#1a1a1a"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8.2 10.2c0 2.6 2 4.6 3.8 5.9"
            stroke="#1a1a1a"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeDasharray="1.6 2.2"
          />
        </svg>
      </span>
    </div>
  );
}

export function HomeHero({ shelf }: { shelf: FeaturedShelf }) {
  const product = spotlightOf(shelf);
  return (
    <section className="hero-wrap">
      <div className="hero-stage">
        <HeroMedia product={product} />
        <div className="hero-shade" />
        <div className="hero-top">
          <p className="hero-live">
            <span className="hero-live-dot" />
            Recibiendo pedidos para esta semana
          </p>
          <HeroSeal />
        </div>
        <h1 className="hero-title">
          <span className="hero-desk">
            <span className="hero-line">Regalos que</span>
            <span className="hero-line hero-line-end">
              <span>Se</span>
              <HeroPill product={product} />
              <span>sienten</span>
            </span>
          </span>
          <span className="hero-mob">
            <span className="hero-line">Regalos</span>
            <span className="hero-line">que se</span>
            <span className="hero-line">sienten</span>
          </span>
        </h1>
        <div className="hero-bottom">
          <div className="hero-copy">
            <p>Hechos a mano en SJL. Personalízalos y recíbelos donde quieras.</p>
            <div className="hero-actions">
              <Link to="/catalogo" search={{ occasion: undefined }} className="hero-cta">
                Explorar regalos
                <ArrowIcon />
              </Link>
              <Link to="/" hash="como" className="hero-cta hero-cta-ghost">
                Cómo funciona
              </Link>
            </div>
          </div>
          <HeroSpotlight product={product} />
        </div>
      </div>
    </section>
  );
}
