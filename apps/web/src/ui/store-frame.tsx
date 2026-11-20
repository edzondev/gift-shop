import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { isAdminPath } from "../store-path";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function StoreFrame({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (isAdminPath(pathname)) return children;
  return (
    <>
      <div className="store-frame">
        <p className="store-announce">
          Pide con 3 días de anticipación · Entrega gratis en estaciones de la Línea 1 💛
        </p>
        <SiteHeader />
      </div>
      {children}
      <SiteFooter />
    </>
  );
}
