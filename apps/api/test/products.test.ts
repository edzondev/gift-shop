import { env } from "cloudflare:workers";
import { beforeEach, expect, it } from "vitest";
import app from "../src/index";

const PRODUCT_NOT_FOUND = {
  error: { code: "product_not_found", message: "Product not found" },
};

const LIMIT_MESSAGE = "limit must be an integer from 1 to 50";

type Seed = {
  id: string;
  slug?: string;
  name?: string;
  stock?: number;
  active?: number;
  occasions?: readonly string[];
  fields?: readonly string[];
  priceCents?: number;
  oldPriceCents?: number | null;
  tag?: string | null;
  prepDays?: number;
  description?: string;
  photos?: readonly { key: string; position: number }[];
};

async function reset(): Promise<void> {
  await env.DB.prepare("DELETE FROM product_photos").run();
  await env.DB.prepare("DELETE FROM products").run();
}

async function insertProduct(product: Seed): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO products (
      id, slug, name, price_cents, old_price_cents, stock, prep_days, description,
      fields, occasions, tag, size_classic, size_large, large_extra_cents, active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      product.id,
      product.slug ?? product.id,
      product.name ?? "Ramo",
      product.priceCents ?? 4500,
      product.oldPriceCents === undefined ? null : product.oldPriceCents,
      product.stock ?? 8,
      product.prepDays ?? 2,
      product.description ?? "Flores de estación",
      JSON.stringify(product.fields ?? []),
      JSON.stringify(product.occasions ?? []),
      product.tag === undefined ? null : product.tag,
      "Clásica",
      "Grande",
      1500,
      product.active ?? 1,
      "2026-11-18T12:00:00-05:00",
    )
    .run();

  for (const photo of product.photos ?? []) {
    await env.DB.prepare(
      "INSERT INTO product_photos (id, product_id, r2_key, position) VALUES (?, ?, ?, ?)",
    )
      .bind(`${product.id}-photo-${photo.position}`, product.id, photo.key, photo.position)
      .run();
  }
}

async function insertMany(count: number): Promise<void> {
  for (let n = 1; n <= count; n += 1) {
    await insertProduct({ id: `p${String(n).padStart(2, "0")}` });
  }
}

function get(path: string, db: D1Database = env.DB) {
  return app.request(path, {}, { DB: db });
}

function query(params: Record<string, string>): string {
  return `/products?${new URLSearchParams(params)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("expected object");
  return value;
}

function entries(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("expected array");
  return value;
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return record(await response.json());
}

function slugs(body: Record<string, unknown>): string[] {
  return entries(body.items).map((item) => {
    const slug = record(item).slug;
    if (typeof slug !== "string") throw new Error("expected slug");
    return slug;
  });
}

function cursorOf(body: Record<string, unknown>): string {
  if (typeof body.nextCursor !== "string") throw new Error("expected cursor");
  return body.nextCursor;
}

function photoKeys(body: Record<string, unknown>): unknown[] {
  return entries(body.items).map((item) => record(item).photoKeys);
}

beforeEach(async () => {
  await reset();
});

it("GET /products defaults to 20 items and a nextCursor when more exist", async () => {
  await insertMany(22);

  const response = await get("/products");
  expect(response.status).toBe(200);
  const body = await bodyOf(response);
  expect(slugs(body)).toHaveLength(20);
  expect(slugs(body)).toEqual(
    Array.from({ length: 20 }, (_, index) => `p${String(index + 1).padStart(2, "0")}`),
  );
  expect(body.nextCursor).toEqual(expect.any(String));
});

it("the second page does not repeat or skip products", async () => {
  await insertMany(22);

  const page1 = await bodyOf(await get("/products"));
  const second = await get(query({ cursor: cursorOf(page1) }));
  expect(second.status).toBe(200);
  const page2 = await bodyOf(second);

  const seen = slugs(page1);
  const rest = slugs(page2);
  expect(rest).toEqual(["p21", "p22"]);
  expect(rest.some((slug) => seen.includes(slug))).toBe(false);
  expect(page2.nextCursor).toBeNull();
});

it("the last page of exactly 20 products has nextCursor null", async () => {
  await insertMany(20);

  const response = await get("/products");
  const body = await bodyOf(response);
  expect(response.status).toBe(200);
  expect(slugs(body)).toHaveLength(20);
  expect(body.nextCursor).toBeNull();
});

it("limit=2 returns two products and a cursor", async () => {
  await insertMany(4);

  const response = await get(query({ limit: "2" }));
  const body = await bodyOf(response);
  expect(response.status).toBe(200);
  expect(slugs(body)).toEqual(["p01", "p02"]);
  expect(body.nextCursor).toEqual(expect.any(String));
});

it("an empty catalog returns no items and nextCursor null", async () => {
  const response = await get("/products");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ items: [], nextCursor: null });
});

it.each(["0", "51", "abc"])("limit=%s returns 422 validation_error", async (limit) => {
  const response = await get(query({ limit }));
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    error: {
      code: "validation_error",
      message: "Validation failed",
      details: { issues: [{ path: "limit", message: LIMIT_MESSAGE }] },
    },
  });
});

it("an unknown occasion returns 422 validation_error", async () => {
  const response = await get(query({ occasion: "navidad" }));
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    error: {
      code: "validation_error",
      message: "Validation failed",
      details: { issues: [{ path: "occasion", message: "unknown occasion" }] },
    },
  });
});

it("filters the list by occasion and leaves hidden products out", async () => {
  await insertProduct({ id: "p01", occasions: ["mama"] });
  await insertProduct({ id: "p02", occasions: ["cumple"] });
  await insertProduct({ id: "p03", occasions: ["mama", "cumple"] });
  await insertProduct({ id: "p04", occasions: ["mama"], active: 0 });

  const response = await get(query({ occasion: "mama" }));
  const body = await bodyOf(response);
  expect(response.status).toBe(200);
  expect(slugs(body)).toEqual(["p01", "p03"]);
  expect(body.nextCursor).toBeNull();
});

it("hidden products are absent from the default list", async () => {
  await insertProduct({ id: "p01" });
  await insertProduct({ id: "p02", active: 0 });

  const body = await bodyOf(await get("/products"));
  expect(slugs(body)).toEqual(["p01"]);
});

it("a hidden product returns 404 product_not_found", async () => {
  await insertProduct({ id: "oculto", slug: "ramo-oculto", active: 0 });

  const response = await get("/products/ramo-oculto");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual(PRODUCT_NOT_FOUND);
});

it("stock above 3 sets stockLeft to null", async () => {
  await insertProduct({ id: "p01", slug: "con-stock", stock: 4 });

  const body = await bodyOf(await get("/products/con-stock"));
  expect(body.stockLeft).toBeNull();
});

it("stock of 3 is returned as stockLeft", async () => {
  await insertProduct({ id: "p01", slug: "justo", stock: 3 });

  const body = await bodyOf(await get("/products/justo"));
  expect(body.stockLeft).toBe(3);
});

it("stock of 2 is returned as stockLeft", async () => {
  await insertProduct({ id: "p01", slug: "bajo", stock: 2 });

  const body = await bodyOf(await get("/products/bajo"));
  expect(body.stockLeft).toBe(2);
});

it("stock of 0 is returned as stockLeft and stays in the list", async () => {
  await insertProduct({ id: "p01", slug: "agotado", stock: 0 });

  const listed = await bodyOf(await get("/products"));
  expect(slugs(listed)).toEqual(["agotado"]);
  const first = entries(listed.items)[0];
  if (first === undefined) throw new Error("expected item");
  expect(record(first).stockLeft).toBe(0);

  const detail = await bodyOf(await get("/products/agotado"));
  expect(detail.stockLeft).toBe(0);
});

it("stock of 0 sets inStock to false", async () => {
  await insertProduct({ id: "p01", slug: "agotado", stock: 0 });

  const body = await bodyOf(await get("/products/agotado"));
  expect(body.inStock).toBe(false);
});

it("stock above 0 sets inStock to true", async () => {
  await insertProduct({ id: "p01", slug: "hay", stock: 2 });

  const body = await bodyOf(await get("/products/hay"));
  expect(body.inStock).toBe(true);
});

it("detail returns photos ordered by position", async () => {
  await insertProduct({
    id: "p01",
    slug: "ramo-mama",
    name: "Ramo para mamá 🌷",
    stock: 2,
    priceCents: 8900,
    oldPriceCents: 9900,
    tag: "Oferta",
    prepDays: 3,
    description: "Rosas y claveles",
    fields: ["nombre", "tarjeta"],
    occasions: ["mama"],
    photos: [
      { key: "photos/mama-c.webp", position: 2 },
      { key: "photos/mama-a.webp", position: 0 },
      { key: "photos/mama-b.webp", position: 1 },
    ],
  });

  const response = await get("/products/ramo-mama");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    id: "p01",
    slug: "ramo-mama",
    name: "Ramo para mamá 🌷",
    priceCents: 8900,
    oldPriceCents: 9900,
    tag: "Oferta",
    occasions: ["mama"],
    prepDays: 3,
    photoKeys: ["photos/mama-a.webp", "photos/mama-b.webp", "photos/mama-c.webp"],
    customizable: true,
    stockLeft: 2,
    description: "Rosas y claveles",
    fields: ["nombre", "tarjeta"],
    sizes: { classic: "Clásica", large: "Grande", largeExtraCents: 1500 },
    inStock: true,
  });
});

it("customizable is false when the product has no fields", async () => {
  await insertProduct({ id: "p01", slug: "simple", fields: [] });

  const body = await bodyOf(await get("/products/simple"));
  expect(body.customizable).toBe(false);
});

it("a missing slug returns 404 product_not_found", async () => {
  const response = await get("/products/no-existe");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual(PRODUCT_NOT_FOUND);
});

it("a garbage cursor returns 422 validation_error", async () => {
  const response = await get(query({ cursor: "%%%" }));
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    error: {
      code: "validation_error",
      message: "Validation failed",
      details: { issues: [{ path: "cursor", message: "cursor is invalid" }] },
    },
  });
});

it("an empty cursor returns 422 validation_error", async () => {
  const response = await get(query({ cursor: "" }));
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    error: {
      code: "validation_error",
      message: "Validation failed",
      details: { issues: [{ path: "cursor", message: "cursor is invalid" }] },
    },
  });
});

it("odd slugs return 404 product_not_found and never 500", async () => {
  const paths = [
    "/products/Mama",
    "/products/a%20b",
    `/products/${encodeURIComponent("mamá")}`,
    `/products/${"x".repeat(300)}`,
    `/products/${encodeURIComponent("🎁")}`,
  ];
  for (const path of paths) {
    const response = await get(path);
    expect(response.status).not.toBe(500);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(PRODUCT_NOT_FOUND);
  }
});

it("hiding a product between pages does not repeat ids or fail", async () => {
  await insertMany(22);

  const page1 = await bodyOf(await get("/products"));
  await env.DB.prepare("UPDATE products SET active = 0 WHERE id IN (?, ?)")
    .bind("p01", "p21")
    .run();

  const second = await get(query({ cursor: cursorOf(page1) }));
  expect(second.status).toBe(200);
  const page2 = await bodyOf(second);
  const page1Ids = slugs(page1);
  const page2Ids = slugs(page2);
  expect(page2Ids).toEqual(["p22"]);
  expect(page2Ids.some((slug) => page1Ids.includes(slug))).toBe(false);
});

it("loads every photo on a page with a single product_photos query", async () => {
  await insertProduct({
    id: "p01",
    photos: [
      { key: "photos/p01-a.webp", position: 0 },
      { key: "photos/p01-b.webp", position: 1 },
    ],
  });
  await insertProduct({
    id: "p02",
    photos: [
      { key: "photos/p02-a.webp", position: 1 },
      { key: "photos/p02-b.webp", position: 0 },
    ],
  });
  await insertProduct({ id: "p03", photos: [{ key: "photos/p03-a.webp", position: 0 }] });

  const sql: string[] = [];
  const db = new Proxy(env.DB, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return (query: string) => {
          sql.push(query);
          return target.prepare(query);
        };
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  const response = await get(query({ limit: "10" }), db);
  expect(response.status).toBe(200);
  const body = await bodyOf(response);
  expect(photoKeys(body)).toEqual([
    ["photos/p01-a.webp", "photos/p01-b.webp"],
    ["photos/p02-b.webp", "photos/p02-a.webp"],
    ["photos/p03-a.webp"],
  ]);
  expect(sql.filter((query) => query.includes("product_photos"))).toEqual([
    expect.stringContaining("IN (?, ?, ?)"),
  ]);
});
