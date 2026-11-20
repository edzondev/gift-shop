import { Link } from "@tanstack/react-router";
import { ArrowIcon } from "./arrow";

function TrainIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="5.5"
        y="3"
        width="13"
        height="13.5"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5.5 10.5h13M9 13.6h.01M15 13.6h.01M8.5 20.5l2-4M15.5 20.5l-2-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 11 12 4.5l8.5 6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 9.5V19.5h13V9.5M10 19.5v-5h4v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeDelivery() {
  return (
    <section className="home-delivery">
      <div className="home-delivery-panel">
        <div className="home-delivery-title">
          <span className="home-kicker home-kicker-ink">¿Cómo te llega?</span>
          <h2>
            Donde
            <br />
            quieras
          </h2>
        </div>
        <div className="home-delivery-options">
          <article className="home-delivery-row">
            <span className="home-delivery-icon">
              <TrainIcon />
            </span>
            <span className="home-delivery-copy">
              <b>Estación del tren</b>
              <span className="home-delivery-detail">
                Línea 1 del Metro. Coordinamos punto y hora por WhatsApp.
              </span>
            </span>
            <span className="home-pill home-pill-free">Gratis</span>
          </article>
          <article className="home-delivery-row">
            <span className="home-delivery-icon">
              <HomeIcon />
            </span>
            <span className="home-delivery-copy">
              <b>Delivery a domicilio</b>
              <span className="home-delivery-detail">
                A cualquier distrito de Lima. El costo depende de tu zona.
              </span>
            </span>
            <span className="home-pill">Según zona</span>
          </article>
          <Link to="/catalogo" search={{ occasion: undefined }} className="hero-cta hero-cta-dark">
            Elegir mi regalo
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}
