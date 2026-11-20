import { Link } from "@tanstack/react-router";
import type { ProductCard } from "api";
import type { FeaturedShelf } from "../featured-shelf";
import { leadingPhotoIndex } from "../photo";
import { ArrowIcon } from "./arrow";
import { HomeCard } from "./card";

function ReadyGrid({ items, prioritize }: { items: readonly ProductCard[]; prioritize: boolean }) {
  const leading = prioritize ? leadingPhotoIndex(items.map((item) => item.photoKeys.length)) : -1;
  return (
    <ul className="home-grid">
      {items.map((product, index) => (
        <HomeCard key={product.slug} product={product} priority={index === leading} />
      ))}
    </ul>
  );
}

function ShelfBody({ shelf }: { shelf: FeaturedShelf }) {
  switch (shelf.kind) {
    case "ready":
      return (
        <ReadyGrid items={shelf.items} prioritize={shelf.items[0]?.photoKeys[0] === undefined} />
      );
    case "empty":
      return <p className="home-note">Todavía no hay regalos destacados esta semana.</p>;
    case "unavailable":
      return (
        <p className="home-note" role="alert">
          No pudimos cargar los regalos de esta semana.
        </p>
      );
    default: {
      const unreachable: never = shelf;
      return unreachable;
    }
  }
}

export function HomeFeatured({ shelf }: { shelf: FeaturedShelf }) {
  return (
    <section className="home-featured" aria-labelledby="destacados-title">
      <div className="home-featured-head">
        <h2 id="destacados-title">
          Los más
          <br />
          pedidos <span className="home-featured-accent">esta semana</span>
        </h2>
        <Link to="/catalogo" search={{ occasion: undefined }} className="home-more">
          Ver todo el catálogo
          <ArrowIcon />
        </Link>
      </div>
      <ShelfBody shelf={shelf} />
    </section>
  );
}
