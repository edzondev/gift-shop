import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import stylesCss from "../styles.css?url";

const fontStylesheet =
  // biome-ignore lint/security/noSecrets: URL pública de Google Fonts, no es una credencial
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75,800&family=Instrument+Serif:ital@1&family=Manrope:wght@400..800&display=swap";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Yashira" },
    ],
    links: [{ rel: "stylesheet", href: stylesCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
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
