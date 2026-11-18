import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { insertItem, insertOrder, insertProduct, orderStatement, stockUpdate } from "./rows";

const STATUSES = [
  "por_verificar",
  "confirmado",
  "en_preparacion",
  "listo",
  "entregado",
  "rechazado",
];

it("inserts a valid product", async () => {
  await insertProduct(env.DB, { id: "prod-valid", slug: "ramo-valid" });

  const row = await env.DB.prepare(
    "SELECT slug, price_cents, stock, prep_days, active FROM products WHERE id = ?",
  )
    .bind("prod-valid")
    .first();

  expect(row).toEqual({
    slug: "ramo-valid",
    price_cents: 4500,
    stock: 3,
    prep_days: 2,
    active: 1,
  });
});

it("rejects negative stock", async () => {
  await insertProduct(env.DB, { id: "prod-stock-ok", slug: "stock-ok", stock: 0 });
  await expect(
    insertProduct(env.DB, { id: "prod-stock-bad", slug: "stock-bad", stock: -1 }),
  ).rejects.toThrow();
});

it("rejects a price of zero cents", async () => {
  await insertProduct(env.DB, { id: "prod-price-ok", slug: "price-ok", priceCents: 1 });
  await expect(
    insertProduct(env.DB, { id: "prod-price-bad", slug: "price-bad", priceCents: 0 }),
  ).rejects.toThrow();
});

it("rejects prep_days above 30", async () => {
  await insertProduct(env.DB, { id: "prod-prep-ok", slug: "prep-ok", prepDays: 30 });
  await expect(
    insertProduct(env.DB, { id: "prod-prep-bad", slug: "prep-bad", prepDays: 31 }),
  ).rejects.toThrow();
});

it("rejects a duplicate slug", async () => {
  await insertProduct(env.DB, { id: "prod-slug-a", slug: "mismo-slug" });
  await expect(insertProduct(env.DB, { id: "prod-slug-b", slug: "mismo-slug" })).rejects.toThrow();
});

it("accepts the six order statuses", async () => {
  for (const status of STATUSES) {
    await insertOrder(env.DB, { idempotencyKey: `status-${status}`, status });
  }

  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM orders WHERE idempotency_key IN (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      "status-por_verificar",
      "status-confirmado",
      "status-en_preparacion",
      "status-listo",
      "status-entregado",
      "status-rechazado",
    )
    .first();
  expect(row).toEqual({ n: STATUSES.length });
});

it("rejects an order status outside the six allowed", async () => {
  await insertOrder(env.DB, { idempotencyKey: "status-ok", status: "por_verificar" });
  await expect(
    insertOrder(env.DB, { idempotencyKey: "status-bad", status: "en_camino" }),
  ).rejects.toThrow();
});

it("rejects a delivery_mode outside estacion and delivery", async () => {
  await insertOrder(env.DB, { idempotencyKey: "mode-estacion", deliveryMode: "estacion" });
  await insertOrder(env.DB, { idempotencyKey: "mode-delivery", deliveryMode: "delivery" });
  await expect(
    insertOrder(env.DB, { idempotencyKey: "mode-bad", deliveryMode: "recojo" }),
  ).rejects.toThrow();
});

it("rejects a duplicate idempotency_key", async () => {
  await insertOrder(env.DB, { idempotencyKey: "same-key" });
  await expect(insertOrder(env.DB, { idempotencyKey: "same-key" })).rejects.toThrow();
});

it("rejects item qty outside 1 through 20", async () => {
  await insertProduct(env.DB, { id: "prod-qty", slug: "qty" });
  const orderId = await insertOrder(env.DB, { idempotencyKey: "qty-order" });

  await insertItem(env.DB, { orderId, productId: "prod-qty", qty: 1 });
  await insertItem(env.DB, { orderId, productId: "prod-qty", qty: 20 });
  await expect(insertItem(env.DB, { orderId, productId: "prod-qty", qty: 0 })).rejects.toThrow();
  await expect(insertItem(env.DB, { orderId, productId: "prod-qty", qty: 21 })).rejects.toThrow();
});

it("stores a name with accents, an emoji, and two lines unchanged", async () => {
  const name = "Ramito de ñandú 🎁\nsegunda línea";
  await insertProduct(env.DB, { id: "prod-text", slug: "texto", name });

  const row = await env.DB.prepare("SELECT name FROM products WHERE id = ?")
    .bind("prod-text")
    .first();
  expect(row).toEqual({ name });
});

it("rolls back the order insert when the stock update would go negative", async () => {
  await insertProduct(env.DB, { id: "prod-batch", slug: "batch", stock: 1 });

  await expect(
    env.DB.batch([
      orderStatement(env.DB, { idempotencyKey: "batch-negative" }),
      stockUpdate(env.DB, "prod-batch", 2),
    ]),
  ).rejects.toThrow();

  const order = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?")
    .bind("batch-negative")
    .first();
  const product = await env.DB.prepare("SELECT stock FROM products WHERE id = ?")
    .bind("prod-batch")
    .first();

  expect(order).toEqual({ n: 0 });
  expect(product).toEqual({ stock: 1 });
});

it("a second batch on the last unit fails and keeps the first order", async () => {
  await insertProduct(env.DB, { id: "prod-race", slug: "race", stock: 1 });

  await env.DB.batch([
    orderStatement(env.DB, { idempotencyKey: "race-first" }),
    stockUpdate(env.DB, "prod-race", 1),
  ]);

  await expect(
    env.DB.batch([
      orderStatement(env.DB, { idempotencyKey: "race-second" }),
      stockUpdate(env.DB, "prod-race", 1),
    ]),
  ).rejects.toThrow();

  const first = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?")
    .bind("race-first")
    .first();
  const second = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?")
    .bind("race-second")
    .first();
  const product = await env.DB.prepare("SELECT stock FROM products WHERE id = ?")
    .bind("prod-race")
    .first();

  expect(first).toEqual({ n: 1 });
  expect(second).toEqual({ n: 0 });
  expect(product).toEqual({ stock: 0 });
});
