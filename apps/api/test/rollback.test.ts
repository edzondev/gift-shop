import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { insertProduct } from "./rows";

const SCHEMA_NAMES = [
  "products",
  "product_photos",
  "orders",
  "order_items",
  "products_active",
  "orders_status",
  "orders_upcoming",
  "orders_created",
  "order_items_order",
];

it("drops the schema tables when the down migration runs", async () => {
  await insertProduct(env.DB, { id: "prod-down", slug: "down" });

  for (const migration of env.TEST_ROLLBACK) {
    for (const query of migration.queries) {
      await env.DB.prepare(query).run();
    }
  }

  const left = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'index') AND name IN (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(...SCHEMA_NAMES)
    .all();

  expect(left.results).toEqual([]);
});
