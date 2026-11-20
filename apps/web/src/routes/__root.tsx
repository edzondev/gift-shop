import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { pedidoHeaders } from "../pedido-headers";
import stylesCss from "../styles.css?url";
import { StoreFrame } from "../ui/store-frame";

const fontStylesheet =
  // biome-ignore lint/security/noSecrets: URL pública de Google Fonts, no es una credencial
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75,800&family=Instrument+Serif:ital@1&family=Manrope:wght@400..800&display=swap";

export const Route = createRootRoute({
  headers: ({ matches }) => {
    const pathname = matches.at(-1)?.pathname ?? "";
    return pedidoHeaders(pathname);
  },
  head: ({ match }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: match._notFound ? "404" : "Yashira" },
    ],
    links: [
      { rel: "stylesheet", href: stylesCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function NotFoundPage() {
  return <h1>404</h1>;
}

function RootComponent() {
  return (
    <RootDocument>
      <StoreFrame>
        <Outlet />
      </StoreFrame>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fontStylesheet} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
