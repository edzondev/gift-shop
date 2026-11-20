import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { routeTree } from "../src/routeTree.gen";
import { documentStatus, withAccessRequest } from "./start-request";

type Rendered = { html: string; status: number; pathname: string };

export async function renderPath(
  pathname: string,
  session: "panel" | "anonymous" = "panel",
  depth = 0,
): Promise<Rendered> {
  if (depth > 4) throw new Error(`redirect loop at ${pathname}`);
  const token = session === "anonymous" ? undefined : "sesion-de-prueba";
  return withAccessRequest(token, async (): Promise<Rendered> => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: [pathname] }),
    });
    await router.load();
    const result = router._serverResult;
    if (result?.type === "redirect") {
      const href = result.redirect.options.href;
      const to = result.redirect.options.to;
      const next = typeof href === "string" ? href : typeof to === "string" ? to : undefined;
      if (next === undefined) throw new Error("expected redirect href");
      return renderPath(next, session, depth + 1);
    }
    if (result?.type !== "render") throw new Error("expected render");
    const helper = documentStatus();
    return {
      html: renderToString(<RouterProvider router={router} />),
      status: helper ?? result.status,
      pathname,
    };
  });
}
