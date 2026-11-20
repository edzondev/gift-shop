import type { AdminProduct } from "api";
import { beforeEach, expect, it } from "vitest";
import { getAdminProduct } from "../src/product.functions";
import { summary } from "./admin-fixture";
import { resetApiFetch, setApiFetch } from "./cloudflare-workers-stub";
import { renderPath } from "./render-path";
import { withAccessRequest } from "./start-request";

const VISIBLE_NAME = "Ramo visible";
const HIDDEN_NAME = "Ramo oculto";

function product(id: string, name: string, active: boolean): AdminProduct {
  return {
    id,
    slug: id,
    name,
    priceCents: 8900,
    oldPriceCents: null,
    tag: null,
    occasions: ["mama"],
    prepDays: 2,
    photoKeys: [],
    customizable: false,
    stockLeft: null,
    description: "Hecho a mano.",
    fields: [],
    sizes: { classic: "Clásica", large: "Grande", largeExtraCents: 1500 },
    inStock: true,
    stock: 8,
    active,
    photos: [],
  };
}

function rawUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return String(input);
}

function productPath(url: string): string | null {
  const parsed = new URL(url);
  if (!parsed.pathname.startsWith("/admin/products")) return null;
  return `${parsed.pathname}${parsed.search}`;
}

function activeInput(html: string): string {
  return /<input[^>]*name="active"[^>]*>/.exec(html)?.[0] ?? "";
}

beforeEach(() => {
  resetApiFetch();
});

function install(reply: (request: Request) => Response): string[] {
  const calls: string[] = [];
  setApiFetch(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    calls.push(`${request.method} ${rawUrl(request)}`);
    const path = new URL(request.url).pathname;
    if (path === "/admin/summary") return Response.json(summary);
    return reply(request);
  });
  return calls;
}

function productCalls(calls: string[]): string[] {
  return calls.flatMap((call) => {
    const path = productPath(call.slice(call.indexOf(" ") + 1));
    return path === null ? [] : [`${call.slice(0, call.indexOf(" "))} ${path}`];
  });
}

it("loads a visible product from GET /admin/products/:id", async () => {
  const calls = install(() => Response.json(product("p05", VISIBLE_NAME, true)));
  const page = await renderPath("/admin/productos/p05");
  expect(page.status).toBe(200);
  expect(page.html).toContain("Editar producto");
  expect(page.html).toContain(`value="${VISIBLE_NAME}"`);
  expect(activeInput(page.html)).toContain("checked");
  expect(productCalls(calls)).toEqual(["GET /admin/products/p05"]);
});

it("loads a hidden product the same way", async () => {
  const calls = install(() => Response.json(product("p23", HIDDEN_NAME, false)));
  const page = await renderPath("/admin/productos/p23");
  expect(page.status).toBe(200);
  expect(page.html).toContain("Editar producto");
  expect(page.html).toContain(`value="${HIDDEN_NAME}"`);
  expect(activeInput(page.html)).not.toContain("checked");
  expect(productCalls(calls)).toEqual(["GET /admin/products/p23"]);
});

it("turns product_not_found into notFound", async () => {
  const calls = install(() =>
    Response.json(
      {
        ...product("ausente", "SECRETO-404", true),
        error: { code: "product_not_found", message: "Product not found" },
      },
      { status: 404 },
    ),
  );
  const page = await renderPath("/admin/productos/ausente");
  expect(page.status).toBe(404);
  expect(page.html).toContain("<h1>404</h1>");
  expect(page.html).not.toContain("SECRETO-404");
  expect(page.html).not.toContain("<h1>Editar producto</h1>");
  expect(productCalls(calls)).toEqual(["GET /admin/products/ausente"]);
});

it("redirects to login on API 401 and does not read that body", async () => {
  const responses: Response[] = [];
  const calls = install(() => {
    const response = Response.json(product("p05", "SECRETO-401", true), { status: 401 });
    responses.push(response);
    return response;
  });
  const page = await renderPath("/admin/productos/p05");
  expect(page.pathname).toBe("/admin/login");
  expect(page.html).toContain("Entrar");
  expect(page.html).not.toContain("SECRETO-401");
  expect(page.html).not.toContain("<h1>Editar producto</h1>");
  expect(responses[0]?.bodyUsed).toBe(false);
  expect(productCalls(calls)).toEqual(["GET /admin/products/p05"]);
});

it("keeps the 403 status on Sin acceso", async () => {
  const calls = install(() => Response.json(product("p05", "SECRETO-403", true), { status: 403 }));
  const page = await renderPath("/admin/productos/p05");
  expect(page.status).toBe(403);
  expect(page.html).toContain("<h1>Sin acceso</h1>");
  expect(page.html).not.toContain("SECRETO-403");
  expect(page.html).not.toContain("<h1>Editar producto</h1>");
  expect(productCalls(calls)).toEqual(["GET /admin/products/p05"]);
});

it("shows an error when the API returns 500", async () => {
  const calls = install(() => Response.json(product("p05", "SECRETO-500", true), { status: 500 }));
  const page = await renderPath("/admin/productos/p05");
  expect(page.html).toContain("No pudimos cargar el producto. Inténtalo de nuevo.");
  expect(page.html).not.toContain("SECRETO-500");
  expect(page.html).not.toContain("<h1>404</h1>");
  expect(productCalls(calls)).toEqual(["GET /admin/products/p05"]);
});

it("forwards the session cookie as a bearer token on the product request", async () => {
  let seen: string | null = null;
  setApiFetch(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    seen = request.headers.get("authorization");
    return Response.json(product("p05", VISIBLE_NAME, true));
  });
  const view = await withAccessRequest("jwt-de-prueba", () => getAdminProduct({ data: "p05" }));
  expect(seen).toBe("Bearer jwt-de-prueba");
  expect(view.kind).toBe("ok");
  if (view.kind !== "ok") return;
  expect(view.product.name).toBe(VISIBLE_NAME);
});

it("returns failed when the product request cannot be sent", async () => {
  setApiFetch(() => Promise.reject(new Error("bad url")));
  const view = await withAccessRequest(undefined, () => getAdminProduct({ data: " " }));
  expect(view.kind).toBe("failed");
});

it("asks the API with hc for odd ids and does not 500", async () => {
  const seen: string[] = [];
  setApiFetch(async (input) => {
    const url = rawUrl(input);
    seen.push(url);
    let pathname = "";
    try {
      pathname = new URL(url).pathname;
    } catch {
      pathname = "";
    }
    if (pathname === "/admin/summary") return Response.json(summary);
    return Response.json(
      { error: { code: "product_not_found", message: "Product not found" } },
      { status: 404 },
    );
  });
  const ids = [" ", "%2F", "🎁", "a".repeat(2048)];
  for (const id of ids) {
    const page = await renderPath(`/admin/productos/${encodeURIComponent(id)}`);
    expect(page.status, id).not.toBe(500);
    expect(page.html.length, id).toBeGreaterThan(0);
  }
  expect(seen.filter((url) => url.includes("/admin/products"))).toEqual([
    "http://api/admin/products/ ",
    "http://api/admin/products/%2F",
    "http://api/admin/products/🎁",
    `http://api/admin/products/${"a".repeat(2048)}`,
  ]);
});
