import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-mark">Taller de Regalos</p>
        <div className="site-footer-row">
          <span>Hecho con 💛 en San Juan de Lurigancho, Lima</span>
          <nav className="site-footer-links" aria-label="Contacto">
            <a href="https://wa.me/51987654321" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a href="/">Instagram</a>
            <a href="/">TikTok</a>
            <Link to="/admin" className="site-footer-panel">
              Panel de la artesana
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
