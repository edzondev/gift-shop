import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { expect, it, vi } from "vitest";
import { pedidoHeaders } from "../src/pedido-headers";
import { routeTree } from "../src/routeTree.gen";
import { withAccessRequest } from "./start-request";

vi.mock("../src/orders.functions", () => ({
  getPublicOrder: () => Promise.resolve({ found: false }),
}));

async function policyFor(pathname: string): Promise<{ status: number; policy: string | null }> {
  return withAccessRequest(undefined, async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: [pathname] }),
    });
    await router.load();
    const result = router._serverResult;
    if (result?.type !== "render") throw new Error(`expected render ${result?.type ?? "none"}`);
    const matches = router.state.matches;
    // The 404 response stops at the root match, so the child route headers are not sent.
    const end = matches.findIndex((match) => match.status !== "success" || match._notFound) + 1;
    const rendered = end && end < matches.length ? matches.slice(0, end) : matches;
    let policy: string | null = null;
    for (const match of rendered) {
      const value = match.headers?.["Referrer-Policy"];
      if (value !== undefined) policy = value;
    }
    return { status: result.status, policy };
  });
}

it("sets referrer-policy on every /pedido response, including 404", async () => {
  expect(pedidoHeaders("/pedido/REG-2026-9999")).toEqual({
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  });
  expect(pedidoHeaders("/checkout")).toBeUndefined();

  const missing = await policyFor("/pedido/REG-2026-9999?t=x");
  expect(missing.status).toBe(404);
  expect(missing.policy).toBe("no-referrer");
});
