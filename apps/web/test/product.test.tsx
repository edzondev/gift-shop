import type { Field, ProductDetail } from "api";
import { expect, it, vi } from "vitest";
import { renderPath } from "./render-path";

vi.mock("../src/products.functions", () => {
  function record(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function detail(input: {
    slug: string;
    name: string;
    inStock: boolean;
    fields: Field[];
    stockLeft: number | null;
  }): ProductDetail {
    return {
      id: input.slug,
      slug: input.slug,
      name: input.name,
      priceCents: 8900,
      oldPriceCents: 9900,
      tag: "Nuevo",
      occasions: ["cumple"],
      prepDays: 3,
      photoKeys: ["photos/a.webp"],
      customizable: input.fields.length > 0,
      stockLeft: input.stockLeft,
      description: "Hecho a mano, con cariño.",
      fields: input.fields,
      sizes: { classic: "Clásica", large: "Grande", largeExtraCents: 1500 },
      inStock: input.inStock,
    };
  }
  const fields: Field[] = ["nombre", "color", "tamano", "tarjeta", "envoltura"];
  return {
    listCatalog: () => Promise.resolve({ items: [], nextCursor: null }),
    getProduct: (input: unknown) => {
      const slug = record(input) && typeof input.data === "string" ? input.data : "";
      if (slug === "no-existe" || slug.length === 0) return Promise.resolve({ kind: "missing" });
      if (slug === "agotado") {
        return Promise.resolve({
          kind: "found",
          product: detail({
            slug,
            name: "Caja vacía",
            inStock: false,
            fields: ["nombre"],
            stockLeft: 0,
          }),
        });
      }
      if (slug === "solo") {
        return Promise.resolve({
          kind: "found",
          product: detail({
            slug,
            name: "Solo tarjeta",
            inStock: true,
            fields: ["tarjeta"],
            stockLeft: 4,
          }),
        });
      }
      if (slug === "ultimo") {
        return Promise.resolve({
          kind: "found",
          product: detail({ slug, name: "Último", inStock: true, fields: [], stockLeft: 1 }),
        });
      }
      return Promise.resolve({
        kind: "found",
        product: detail({
          slug,
          name: "Piñata de corazón 🎁",
          inStock: true,
          fields,
          stockLeft: null,
        }),
      });
    },
  };
});

function plusDisabled(html: string): boolean {
  const match = /<button[^>]*aria-label="Más"[^>]*>/.exec(html);
  if (match === null) return false;
  return match[0].includes("disabled");
}

it("answers 404 when the product does not exist", async () => {
  const page = await renderPath("/producto/no-existe");
  expect(page.status).toBe(404);
  expect(page.html).toContain("<h1>404</h1>");
  expect(page.html).not.toContain("Agregar al carrito");
});

it("renders the active fields and blocks an out-of-stock product", async () => {
  const product = await renderPath("/producto/pinata");
  expect(product.status).toBe(200);
  expect(product.html).toContain("Piñata de corazón 🎁");
  expect(product.html).toContain("¿Para quién es?");
  expect(product.html).toContain("Terracota");
  expect(product.html).toContain("Clásica");
  expect(product.html).toContain("Grande");
  expect(product.html).toContain("Tarjeta con dedicatoria");
  expect(product.html).toContain("Envoltura");
  expect(product.html).toContain("Cantidad");
  expect(product.html).toContain("Total");
  expect(product.html).not.toContain("Agregar al carrito");

  const agotado = await renderPath("/producto/agotado");
  expect(agotado.status).toBe(200);
  expect(agotado.html).toContain("Agotado");
  expect(agotado.html).not.toContain("¿Para quién es?");
  expect(agotado.html).not.toContain("Agregar al carrito");

  const solo = await renderPath("/producto/solo");
  expect(solo.html).toContain("Tarjeta con dedicatoria");
  expect(solo.html).not.toContain("¿Para quién es?");
  expect(solo.html).not.toContain("Elige el color");
  expect(solo.html).not.toContain("Tamaño");

  const last = await renderPath("/producto/ultimo");
  expect(plusDisabled(last.html)).toBe(true);
});
