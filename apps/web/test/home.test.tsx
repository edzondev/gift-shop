import { expect, it } from "vitest";
import { renderPath } from "./render-path";

const knownRoutes: ReadonlyArray<readonly [string, string]> = [
  ["/", "<h1>Inicio</h1>"],
  ["/admin", "<h1>Admin</h1>"],
];

const unknownRoutes = ["/no-existe", "/a%20b", "/%C3%B1"];

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
