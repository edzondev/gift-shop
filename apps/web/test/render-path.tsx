import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { routeTree } from "../src/routeTree.gen";

export async function renderPath(pathname: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [pathname] }),
  });
  await router.load();
  const result = router._serverResult;
  if (result?.type === "redirect") {
    const href = result.redirect.options.href;
    if (typeof href !== "string") throw new Error("expected redirect href");
    return renderPath(href);
  }
  if (result?.type !== "render") throw new Error("expected render");
  return {
    html: renderToString(<RouterProvider router={router} />),
    status: result.status,
    pathname,
  };
}
