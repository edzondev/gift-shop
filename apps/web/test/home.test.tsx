import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { routeTree } from "../src/routeTree.gen";

it("renders the Inicio title for /", async () => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();

  const html = renderToString(<RouterProvider router={router} />);
  expect(html).toContain("<h1>Inicio</h1>");
});
