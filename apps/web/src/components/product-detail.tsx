import { Link } from "@tanstack/react-router";
import type { ProductDetail as Detail } from "api";
import { ProductConfigurator } from "./product-configurator";
import { ProductFacts } from "./product-facts";
import { ProductGallery } from "./product-gallery";

export function ProductDetailView({ product }: { product: Detail }) {
  return (
    <article className="product">
      <p className="crumbs">
        <Link to="/catalogo" search={{ occasion: undefined }}>
          Catálogo
        </Link>
        <span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </p>
      <div className="product-layout">
        <ProductGallery slug={product.slug} photoKeys={product.photoKeys} label={product.name} />
        <div className="product-copy">
          <ProductFacts product={product} agotado={!product.inStock} />
          <h1>{product.name}</h1>
          <p className="product-description">{product.description}</p>
          <ProductConfigurator key={product.id} product={product} />
          <section className="handoff" aria-label="Entrega">
            <div>
              <span className="handoff-icon" aria-hidden="true">
                <TrainIcon />
              </span>
              <span>
                <b>Entrega en estación del tren · Gratis</b>
                <span>Línea 1 del Metro de Lima. Coordinamos el punto y la hora por WhatsApp.</span>
              </span>
            </div>
            <div>
              <span className="handoff-icon" aria-hidden="true">
                <HomeIcon />
              </span>
              <span>
                <b>Delivery a domicilio</b>
                <span>
                  A todo Lima. El costo depende de tu zona y te lo confirmamos antes de enviar.
                </span>
              </span>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}

function TrainIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5.5" y="3" width="13" height="13.5" rx="3.5" />
      <path d="M5.5 10.5h13" />
      <path d="M9 13.6h.01M15 13.6h.01" />
      <path d="M8.5 20.5l2-4M15.5 20.5l-2-4" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 11L12 4.5l8.5 6.5" />
      <path d="M5.5 9.5V19.5h13V9.5" />
      <path d="M10 19.5v-5h4v5" />
    </svg>
  );
}
