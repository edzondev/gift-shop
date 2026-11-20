import { beforeEach, expect, it } from "vitest";
import { order, summary } from "./admin-fixture";
import { resetApiFetch, setApiFetch } from "./cloudflare-workers-stub";
import { renderPath } from "./render-path";

function requestOf(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? input : new Request(input, init);
}

beforeEach(() => {
  resetApiFetch();
});

it("redirects /admin to login when the API answers 401 and hides the order", async () => {
  setApiFetch(async () =>
    Response.json({ customerName: "SECRETO-PEDIDO", note: "SECRETO" }, { status: 401 }),
  );
  const page = await renderPath("/admin");
  expect(page.pathname).toBe("/admin/login");
  expect(page.html).toContain("Entrar");
  expect(page.html).not.toContain("SECRETO");
  expect(page.html).not.toContain("Lucía");
});

it("redirects /admin to login when the session cookie is missing", async () => {
  setApiFetch(async () => Response.json(summary));
  const page = await renderPath("/admin", "anonymous");
  expect(page.pathname).toBe("/admin/login");
  expect(page.html).toContain("Entrar");
  expect(page.html).not.toContain("Lucía");
  expect(page.html).not.toContain("Buenos días");
});

it("keeps the 403 status when the API forbids the panel", async () => {
  setApiFetch(async () => Response.json({ customerName: "SECRETO-PEDIDO" }, { status: 403 }));
  const page = await renderPath("/admin");
  expect(page.status).toBe(403);
  expect(page.html).toContain("Sin acceso");
  expect(page.html).not.toContain("SECRETO");
});

it("renders a missing order as 404", async () => {
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    if (new URL(request.url).pathname === "/admin/summary") return Response.json(summary);
    return new Response("", { status: 404 });
  });
  const page = await renderPath("/admin/pedidos/NOEXISTE");
  expect(page.status).toBe(404);
  expect(page.html).toContain("<h1>404</h1>");
  expect(page.html).not.toContain("Lucía");
  expect(page.html).not.toContain("Captura de Yape");
});

it("ignores an invalid status filter and keeps a long note on its own lines", async () => {
  const urls: string[] = [];
  const longName = `${"María José ".repeat(12)}✨`;
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    const url = new URL(request.url);
    urls.push(`${url.pathname}${url.search}`);
    if (url.pathname === "/admin/summary") return Response.json(summary);
    if (url.pathname === "/admin/orders") return Response.json({ items: [], nextCursor: null });
    return Response.json({
      ...order,
      customer: { ...order.customer, name: longName },
      note: "Primera línea\nSegunda línea",
    });
  });

  const filtered = await renderPath(
    `/admin/pedidos?${new URLSearchParams({ status: "xyz", q: "  ñandú 🎁  " })}`,
  );
  expect(filtered.status).toBe(200);
  expect(filtered.html).toContain("No hay pedidos con este filtro.");
  expect(filtered.html).toContain("ñandú 🎁");
  expect(urls.some((url) => url.startsWith("/admin/orders") && !url.includes("status="))).toBe(
    true,
  );
  expect(urls.some((url) => url.includes("status=xyz"))).toBe(false);

  const detail = await renderPath("/admin/pedidos/REG-2026-0012");
  expect(detail.status).toBe(200);
  expect(detail.html).toContain("order-note");
  expect(detail.html).toContain("clamp");
  expect(detail.html).toContain("Primera línea\nSegunda línea");
  expect(detail.html).toContain(longName);
  expect(detail.html).toContain("Confirmar pago");
  expect(detail.html).toContain("Rechazar");
  expect(detail.html).toContain("Salir");
});
