import type { ProductCard } from "api";
import { beforeEach, expect, it } from "vitest";
import homeCss from "../src/home.css?raw";
import styles from "../src/styles.css?raw";
import { resetApiFetch, setApiFetch } from "./cloudflare-workers-stub";
import { renderPath } from "./render-path";

const pinata = {
  slug: "pinata-corazon",
  name: "Piñata de corazón 🎁 para la celebración más larga del año",
  priceCents: 8500,
  oldPriceCents: 10000,
  tag: "El más pedido",
  occasions: ["cumple"],
  prepDays: 3,
  photoKeys: ["photos/pinata.webp"],
  customizable: true,
  stockLeft: 3,
} satisfies ProductCard;

const ramo = {
  slug: "ramo-mama",
  name: "Ramo para mamá",
  priceCents: 5600,
  oldPriceCents: null,
  tag: null,
  occasions: ["mama"],
  prepDays: 2,
  photoKeys: [],
  customizable: false,
  stockLeft: null,
} satisfies ProductCard;

const tercero = {
  ...ramo,
  slug: "taza-oliva",
  name: "Taza de oliva",
  photoKeys: [],
} satisfies ProductCard;

const cuarto = {
  ...ramo,
  slug: "caja-kraft",
  name: "Caja kraft",
  photoKeys: ["photos/caja.webp"],
} satisfies ProductCard;

const extra = {
  ...ramo,
  slug: "extra-fuera",
  name: "Extra que no entra en la vitrina",
  photoKeys: ["photos/extra.webp"],
} satisfies ProductCard;

function requestOf(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? input : new Request(input, init);
}

beforeEach(() => {
  resetApiFetch();
});

it("keeps the sticky header blur and pauses the marquee when motion is reduced", () => {
  expect(styles).toContain("rgba(250, 248, 245, 0.88)");
  expect(styles).toContain("backdrop-filter: blur(14px)");
  expect(homeCss).toContain("prefers-reduced-motion: reduce");
  expect(homeCss).toContain("animation: none");
});

it("renders the home page from the catalog", async () => {
  const paths: string[] = [];
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    paths.push(new URL(request.url).pathname);
    return Response.json({ items: [pinata, ramo, tercero, cuarto, extra], nextCursor: null });
  });

  const page = await renderPath("/");
  expect(page.status).toBe(200);
  expect(paths).toContain("/products");
  expect(page.html).toContain("Regalos que");
  expect(page.html).toContain("sienten");
  expect(page.html).toContain("Cumpleaños");
  expect(page.html).toContain("con cariño");
  expect(page.html).toContain("Los más");
  expect(page.html).toContain(pinata.name);
  expect(page.html).toContain(ramo.name);
  expect(page.html).toContain(tercero.name);
  expect(page.html).toContain(cuarto.name);
  expect(page.html).toContain('href="/producto/pinata-corazon"');
  expect(page.html).toContain('href="/producto/ramo-mama"');
  expect(page.html).not.toContain("extra-fuera");
  expect(page.html).toContain('src="/img/photos/pinata.webp"');
  expect(page.html).toContain('width="800"');
  expect(page.html).toContain('height="1000"');
  expect(page.html).toContain('fetchPriority="high"');
  expect(page.html).toContain('aria-label="Ramo para mamá"');
  expect(page.html).toContain('id="como"');
  expect(page.html).toContain("Cuatro pasos, cero estrés");
  expect(page.html).toContain("Donde");
  expect(page.html).toContain("quieras");
  expect(page.html).toContain("San Juan de Lurigancho");
  expect(page.html).toContain('href="/#como"');
  expect(page.html).toContain("Catálogo");
  expect(page.html).toContain("Carrito");
  expect(page.html).toContain("−15%");
});

it("renders a clear empty shelf without a 500", async () => {
  setApiFetch(async () => Response.json({ items: [], nextCursor: null }));
  const page = await renderPath("/");
  expect(page.status).toBe(200);
  expect(page.html).toContain("Regalos que");
  expect(page.html).toContain("Todavía no hay regalos destacados esta semana.");
  expect(page.html).not.toContain('href="/producto/');
  expect(page.html).toContain('id="como"');
  expect(page.html).toContain("San Juan de Lurigancho");
});

it("stays on 200 when the catalog API fails", async () => {
  setApiFetch(async () => new Response("no", { status: 500 }));
  const page = await renderPath("/");
  expect(page.status).toBe(200);
  expect(page.html).toContain("Regalos que");
  expect(page.html).toContain("No pudimos cargar los regalos de esta semana.");
  expect(page.html).not.toContain('href="/producto/');
  expect(page.html).toContain('id="como"');
  expect(page.html).toContain("site-footer");
});

it("stays on 200 when the catalog API rejects", async () => {
  setApiFetch(() => Promise.reject(new Error("timeout")));
  const page = await renderPath("/");
  expect(page.status).toBe(200);
  expect(page.html).toContain("No pudimos cargar los regalos de esta semana.");
  expect(page.html).toContain("Regalos que");
});
