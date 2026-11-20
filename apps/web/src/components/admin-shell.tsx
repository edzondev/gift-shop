import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type ReactNode, useRef, useState } from "react";
import { beginLogout, releaseSubmit } from "../admin-session";
import { logoutAdmin } from "../admin-session.functions";

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
          <LogoutButton className="nav-link nav-quiet" />
        </nav>
      </aside>
      <div className="admin-main">
        <header className="admin-mobile-bar">
          <span>
            Taller de Regalos <span className="brand-kicker">admin</span>
          </span>
          <LogoutButton className="btn btn-ghost btn-small" />
        </header>
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

function LogoutButton({ className }: { className: string }) {
  const logout = useServerFn(logoutAdmin);
  const navigate = useNavigate();
  const gate = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function exit() {
    const attempt = beginLogout(isLoggingOut, gate);
    if (attempt.kind === "ignored") return;
    setIsLoggingOut(true);
    void logout()
      .then(async () => {
        await navigate({ to: "/admin/login" });
      })
      .catch(() => {
        releaseSubmit(gate);
        setIsLoggingOut(false);
      });
  }

  return (
    <button type="button" className={className} onClick={exit} disabled={isLoggingOut}>
      {isLoggingOut ? "Saliendo…" : "Salir"}
    </button>
  );
}
