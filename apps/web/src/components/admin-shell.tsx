import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const exact = { exact: true } as const;
const prefix = { exact: false } as const;

export function AdminShell({ toVerify, children }: { toVerify: number; children: ReactNode }) {
  return (
    <div className="admin">
      <aside className="admin-side">
        <p className="brand">
          Taller de
          <br />
          Regalos
        </p>
        <p className="brand-kicker">panel de la artesana</p>
        <nav className="side-nav" aria-label="Secciones">
          <Link
            to="/admin"
            activeOptions={exact}
            className="nav-link"
            activeProps={{ className: "nav-link nav-current" }}
          >
            Resumen
          </Link>
          <Link
            to="/admin/pedidos"
            activeOptions={prefix}
            className="nav-link"
            activeProps={{ className: "nav-link nav-current" }}
          >
            Pedidos
            <span className="badge">{toVerify}</span>
          </Link>
          <Link
            to="/admin/productos"
            activeOptions={prefix}
            className="nav-link"
            activeProps={{ className: "nav-link nav-current" }}
          >
            Productos
          </Link>
          <Link to="/" className="nav-link nav-quiet">
            Ver tienda
          </Link>
        </nav>
      </aside>
      <div className="admin-main">
        <p className="admin-mobile-bar">
          Taller de Regalos <span className="brand-kicker">admin</span>
        </p>
        {children}
      </div>
      <nav className="admin-tabs" aria-label="Secciones">
        <Link
          to="/admin"
          activeOptions={exact}
          className="tab"
          activeProps={{ className: "tab tab-current" }}
        >
          Resumen
        </Link>
        <Link
          to="/admin/pedidos"
          activeOptions={prefix}
          className="tab"
          activeProps={{ className: "tab tab-current" }}
        >
          Pedidos
        </Link>
        <Link
          to="/admin/productos"
          activeOptions={prefix}
          className="tab"
          activeProps={{ className: "tab tab-current" }}
        >
          Productos
        </Link>
        <Link to="/" className="tab">
          Tienda
        </Link>
      </nav>
    </div>
  );
}
