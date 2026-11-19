import { expect, it, vi } from "vitest";
import { formatSoles } from "../src/money";
import { renderPath } from "./render-path";

const calls = vi.hoisted(() => {
  const list: unknown[] = [];
  return list;
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const catalog = vi.hoisted(() => {
  const pinataCard = {
    slug: "pinata-corazon",
    name: "Piñata de corazón 🎁 para la celebración más larga del año",
    priceCents: 8900,
    oldPriceCents: 9900,
    tag: "Nuevo",
    occasions: ["cumple"],
    prepDays: 3,
    photoKeys: ["photos/pinata.webp"],
    customizable: true,
    stockLeft: 2,
  };
  const ramoCard = {
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
  };
  return { pinataCard, ramoCard };
});

vi.mock("../src/products.functions", () => {
  function record(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  return {
    listCatalog: (input: unknown) => {
      calls.push(input);
      const data = record(input) && record(input.data) ? input.data : null;
      if (data?.occasion === "cumple")
        return Promise.resolve({ items: [catalog.pinataCard], nextCursor: null });
      if (data?.occasion === "bebe") return Promise.resolve({ items: [], nextCursor: null });
      return Promise.resolve({
        items: [catalog.pinataCard, catalog.ramoCard],
        nextCursor: "more-1",
      });
    },
    getProduct: () => Promise.resolve({ kind: "missing" }),
  };
});

function occasionOf(input: unknown): unknown {
  if (!isRecord(input) || !isRecord(input.data)) return undefined;
  return input.data.occasion;
}

it("renders the catalog from the injected page", async () => {
  const page = await renderPath("/catalogo");
  expect(page.status).toBe(200);
  expect(page.html).toContain(catalog.pinataCard.name);
  expect(page.html).toContain("product-card-name");
  expect(page.html).toContain(formatSoles(catalog.pinataCard.priceCents));
  expect(page.html).toContain(`<s>${formatSoles(9900)}</s>`);
  expect(page.html).toContain("Nuevo");
  expect(page.html).toContain("Listo en 3 días");
  expect(page.html).toContain("Quedan 2");
  expect(page.html).toContain('src="/img/photos/pinata.webp"');
  expect(page.html).toContain(`alt="${catalog.pinataCard.name}"`);
  expect(page.html).toContain('width="800"');
  expect(page.html).toContain('height="1000"');
  expect(page.html).toContain('fetchPriority="high"');
  expect(page.html.match(/<img /g)).toHaveLength(1);
  expect(page.html).toContain("Personalizable");
  expect(page.html).toContain(catalog.ramoCard.name);
  expect(page.html).toContain("Ver más");
  expect(occasionOf(calls.at(-1))).toBeUndefined();
});

it("filters a valid occasion and ignores an invalid one", async () => {
  const cumple = await renderPath("/catalogo?occasion=cumple");
  expect(cumple.status).toBe(200);
  expect(cumple.html).toContain(catalog.pinataCard.name);
  expect(cumple.html).not.toContain(catalog.ramoCard.name);
  expect(occasionOf(calls.at(-1))).toBe("cumple");

  const invalid = await renderPath("/catalogo?occasion=xyz");
  expect(invalid.status).toBe(200);
  expect(invalid.html).toContain(catalog.ramoCard.name);
  expect(occasionOf(calls.at(-1))).toBeUndefined();
});

it("shows text when the page is empty", async () => {
  const page = await renderPath("/catalogo?occasion=bebe");
  expect(page.status).toBe(200);
  expect(page.html).toContain("Todavía no hay regalos para esta ocasión.");
  expect(page.html).not.toContain("product-grid");
  expect(page.html).not.toContain(catalog.pinataCard.name);
});
