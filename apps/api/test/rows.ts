const PRODUCT_INSERT =
  "INSERT INTO products (id, slug, name, price_cents, stock, prep_days, description, fields, occasions, size_classic, size_large, large_extra_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

const ORDER_INSERT =
  "INSERT INTO orders (idempotency_key, request_hash, token_hash, status, customer_name, phone, delivery_mode, delivery_date, subtotal_cents, yape_operation, capture_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

const ITEM_INSERT =
  "INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price_cents, options) VALUES (?, ?, ?, ?, ?, ?)";

const STOCK_UPDATE = "UPDATE products SET stock = stock - ? WHERE id = ?";

export type ProductSeed = {
  id: string;
  slug: string;
  name?: string;
  priceCents?: number;
  stock?: number;
  prepDays?: number;
};

export type OrderSeed = {
  idempotencyKey: string;
  status?: string;
  deliveryMode?: string;
};

export async function insertProduct(db: D1Database, product: ProductSeed): Promise<void> {
  await db
    .prepare(PRODUCT_INSERT)
    .bind(
      product.id,
      product.slug,
      product.name ?? "Ramo de rosas",
      product.priceCents ?? 4500,
      product.stock ?? 3,
      product.prepDays ?? 2,
      "Flores de estación",
      "[]",
      "[]",
      "Clásica",
      "Grande",
      1500,
      "2026-11-18T12:00:00-05:00",
    )
    .run();
}

export function orderStatement(db: D1Database, order: OrderSeed): D1PreparedStatement {
  return db
    .prepare(ORDER_INSERT)
    .bind(
      order.idempotencyKey,
      "request-hash",
      "token-hash",
      order.status ?? "por_verificar",
      "Ana",
      "999888777",
      order.deliveryMode ?? "estacion",
      "2026-12-01",
      4500,
      "123456",
      "captures/yape",
      "2026-11-18T12:00:00-05:00",
    );
}

export async function insertOrder(db: D1Database, order: OrderSeed): Promise<number> {
  const result = await orderStatement(db, order).run();
  return result.meta.last_row_id;
}

export async function insertItem(
  db: D1Database,
  item: { orderId: number; productId: string; qty: number },
): Promise<void> {
  await db
    .prepare(ITEM_INSERT)
    .bind(item.orderId, item.productId, "Ramo de rosas", item.qty, 4500, "{}")
    .run();
}

export function stockUpdate(db: D1Database, productId: string, qty: number): D1PreparedStatement {
  return db.prepare(STOCK_UPDATE).bind(qty, productId);
}
