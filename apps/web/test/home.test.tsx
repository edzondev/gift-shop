import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { routeTree } from "../src/routeTree.gen";

const knownRoutes: ReadonlyArray<readonly [string, string]> = [
  ["/", "<h1>Inicio</h1>"],
  // biome-ignore lint/security/noSecrets: texto visible de la página, no es una credencial
  ["/catalogo", "<h1>Catálogo</h1>"],
  ["/producto/demo", "<h1>demo</h1>"],
  ["/admin", "<h1>Admin</h1>"],
];

const unknownRoutes = ["/no-existe", "/a%20b", "/%C3%B1"];

async function renderPath(pathname: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [pathname] }),
  });

  await router.load();

  const result = router._serverResult;
  if (result?.type !== "render") {
    throw new Error("expected render");
  }

  return {
    html: renderToString(<RouterProvider router={router} />),
    status: result.status,
  };
}

it("renders the 404 UI for an unknown route", async () => {
  for (const pathname of unknownRoutes) {
    const page = await renderPath(pathname);
    expect(page.status).toBe(404);
    expect(page.html).toContain("<h1>404</h1>");
  }
});

it("renders known routes", async () => {
  for (const [pathname, heading] of knownRoutes) {
    const page = await renderPath(pathname);
    expect(page.status).toBe(200);
    expect(page.html).toContain(heading);
  }

  const missing = await renderPath("/no-existe");
  expect(missing.status).toBe(404);
  expect(missing.html).toContain("<h1>404</h1>");
});
