import { env } from "cloudflare:workers";
import { beforeEach, expect, it } from "vitest";
import app from "../src/index";
import {
  addDays,
  earliestDeliveryDate,
  limaTimestamp,
  limaToday,
  newOrderToken,
  orderCode,
  orderIdFromCode,
  tokenHash,
  tokenMatches,
} from "../src/orders/logic";

const ORDER_NOT_FOUND = { error: { code: "order_not_found", message: "Order not found" } };
const FILE_TOO_LARGE = { error: { code: "file_too_large", message: "File is too large" } };
const UNSUPPORTED = { error: { code: "unsupported_file_type", message: "Unsupported file type" } };
const CONFLICT = {
  error: {
    code: "idempotency_conflict",
    message: "Idempotency key was reused with a different request",
  },
};
const TOO_SOON = {
  error: { code: "delivery_date_too_soon", message: "Delivery date is too soon" },
};
const NOT_FOUND = { error: { code: "not_found", message: "Not Found" } };

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

type Seed = {
  id: string;
  name?: string;
  stock?: number;
  active?: number;
  fields?: readonly string[];
  priceCents?: number;
  prepDays?: number;
  largeExtraCents?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("expected object");
  return value;
}

function createdOrder(value: unknown): {
  code: string;
  token: string;
  status: string;
  totalCents: number;
} {
  const body = record(value);
  if (
    typeof body.code !== "string" ||
    typeof body.token !== "string" ||
    typeof body.status !== "string" ||
    typeof body.totalCents !== "number"
  ) {
    throw new Error("expected created order");
  }
  return { code: body.code, token: body.token, status: body.status, totalCents: body.totalCents };
}

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    customer: { name: "María Ñoño", phone: "999111222", email: "ana@example.com" },
    delivery: { mode: "estacion", station: "Bayóvar", slot: "manana" },
    deliveryDate: addDays(limaToday(new Date()), 10),
    note: "sin apuro",
    items: [{ productId: "p01", qty: 1, size: "clasica" }],
    yapeOperation: "123456",
    expectedTotalCents: 4500,
    ...overrides,
  };
}

function fileFrom(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes], name, { type });
}

async function captureKeys(): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const listed =
      cursor === undefined
        ? await env.FILES.list({ prefix: "captures/" })
        : await env.FILES.list({ prefix: "captures/", cursor });
    for (const object of listed.objects) keys.push(object.key);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined);
  return keys;
}

async function reset(): Promise<void> {
  await env.DB.prepare("DELETE FROM order_items").run();
  await env.DB.prepare("DELETE FROM orders").run();
  await env.DB.prepare("DELETE FROM product_photos").run();
  await env.DB.prepare("DELETE FROM products").run();
  await Promise.all((await captureKeys()).map((key) => env.FILES.delete(key)));
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
      product.id,
      product.name ?? "Ramo",
      product.priceCents ?? 4500,
      null,
      product.stock ?? 8,
      product.prepDays ?? 2,
      "Flores de estación",
      JSON.stringify(product.fields ?? []),
      "[]",
      null,
      "Clásica",
      "Grande",
      product.largeExtraCents ?? 1500,
      product.active ?? 1,
      "2026-11-18T12:00:00-05:00",
    )
    .run();
}

async function stockOf(id: string): Promise<number> {
  const raw = await env.DB.prepare("SELECT stock FROM products WHERE id = ?").bind(id).first();
  const stock = record(raw).stock;
  if (typeof stock !== "number") throw new Error("expected stock");
  return stock;
}

async function orderCount(): Promise<number> {
  const raw = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first();
  const n = record(raw).n;
  if (typeof n !== "number") throw new Error("expected count");
  return n;
}

function post(
  options: {
    order?: unknown;
    orderText?: string;
    capture?: File;
    omitOrder?: boolean;
    omitCapture?: boolean;
    key?: string;
    omitKey?: boolean;
    db?: D1Database;
  } = {},
) {
  const form = new FormData();
  if (options.omitOrder !== true) {
    if (options.orderText !== undefined) form.set("order", options.orderText);
    else form.set("order", JSON.stringify(options.order ?? baseOrder()));
  }
  if (options.omitCapture !== true) {
    form.set("capture", options.capture ?? fileFrom(JPEG, "pago.jpg", "image/jpeg"));
  }
  const headers = new Headers();
  if (options.omitKey !== true) headers.set("Idempotency-Key", options.key ?? crypto.randomUUID());
  return app.request(
    "/orders",
    { method: "POST", headers, body: form },
    {
      DB: options.db ?? env.DB,
      FILES: env.FILES,
    },
  );
}

function getOrder(code: string, token?: string, db: D1Database = env.DB) {
  const headers = new Headers();
  if (token !== undefined) headers.set("X-Order-Token", token);
  return app.request(
    `/orders/${encodeURIComponent(code)}`,
    { headers },
    { DB: db, FILES: env.FILES },
  );
}

async function expectValidation(response: Response, issues: { path: string; message: string }[]) {
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    error: { code: "validation_error", message: "Validation failed", details: { issues } },
  });
}

beforeEach(async () => {
  await reset();
});

it("computes the earliest delivery date from today and prep days", () => {
  expect(earliestDeliveryDate("2026-01-31", [1])).toBe("2026-02-03");
  expect(earliestDeliveryDate("2026-01-31", [5])).toBe("2026-02-05");
  expect(earliestDeliveryDate("2024-02-27", [3])).toBe("2024-03-01");
});

it("stores Lima time, not UTC, including the new-year boundary", () => {
  expect(limaTimestamp(new Date("2026-11-18T18:47:00.123Z"))).toBe("2026-11-18T13:47:00.123-05:00");
  expect(limaTimestamp(new Date("2026-01-01T04:30:00.000Z"))).toBe("2025-12-31T23:30:00.000-05:00");
  expect(orderCode("2025-12-31T23:30:00.000-05:00", 12)).toBe("REG-2025-0012");
  expect(orderIdFromCode("REG-2025-0012")).toBe(12);
  expect(orderIdFromCode("REG-2026-12")).toBeNull();
  expect(orderIdFromCode("reg-2026-0001")).toBeNull();
});

it("compares order tokens by their hash in constant time", async () => {
  const token = newOrderToken();
  const hash = await tokenHash(token);
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(hash).toHaveLength(64);
  expect(await tokenMatches(token, hash)).toBe(true);
  expect(await tokenMatches(`${token}x`, hash)).toBe(false);
  expect(await tokenMatches(token, "ab")).toBe(false);
});

it("creates an order, stores the capture, lowers stock, and accepts the token", async () => {
  await insertProduct({ id: "p01", name: "Ramo de ñandú", stock: 8 });
  const payload = baseOrder({
    customer: { name: "María Ñoño 🌷", phone: "999111222", email: "ana@example.com" },
    note: "dedicatoria con ñ",
  });
  const response = await post({ order: payload });
  expect(response.status).toBe(201);
  const created = createdOrder(await response.json());
  expect(created.status).toBe("por_verificar");
  expect(created.totalCents).toBe(4500);
  expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

  const row = record(
    await env.DB.prepare(
      "SELECT id, created_at, customer_name, token_hash, capture_key, phone, email FROM orders",
    ).first(),
  );
  if (
    typeof row.id !== "number" ||
    typeof row.created_at !== "string" ||
    typeof row.token_hash !== "string"
  ) {
    throw new Error("expected order row");
  }
  expect(created.code).toBe(orderCode(row.created_at, row.id));
  expect(row.created_at.slice(0, 10)).toBe(limaToday(new Date()));
  expect(row.created_at).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}-05:00$/);
  expect(row.customer_name).toBe("María Ñoño 🌷");
  expect(row.token_hash).toBe(await tokenHash(created.token));
  expect(row.token_hash).not.toBe(created.token);
  expect(await stockOf("p01")).toBe(7);

  const keys = await captureKeys();
  expect(keys).toHaveLength(1);
  const key = keys[0];
  if (key === undefined || typeof row.capture_key !== "string") throw new Error("expected capture");
  expect(key).toBe(row.capture_key);
  expect(key.endsWith(".jpg")).toBe(true);
  const stored = await env.FILES.get(key);
  if (stored === null) throw new Error("expected object");
  expect(stored.httpMetadata?.contentType).toBe("image/jpeg");
  expect(new Uint8Array(await stored.arrayBuffer())).toEqual(JPEG);

  const again = await getOrder(created.code, created.token);
  expect(again.status).toBe(200);
  const body = record(await again.json());
  expect(body).toMatchObject({
    code: created.code,
    status: "por_verificar",
    delivery: { mode: "estacion", station: "Bayóvar", slot: "manana" },
    deliveryCostCents: 0,
    subtotalCents: 4500,
    yapeOperation: "123456",
    items: [
      {
        productName: "Ramo de ñandú",
        qty: 1,
        options: ["Clásica"],
        cardMessage: null,
        lineTotalCents: 4500,
      },
    ],
  });
  expect(body).not.toHaveProperty("verifiedAt");
  const text = JSON.stringify(body);
  expect(text).not.toContain("999111222");
  expect(text).not.toContain("ana@example.com");
  expect(text).not.toContain("dedicatoria con ñ");
  expect(text).not.toContain("captures/");

  const image = await app.request("/captures/pago.jpg");
  expect(image.status).toBe(404);
  expect(await image.json()).toEqual(NOT_FOUND);
});

it.each([
  ["png", PNG, "image/png", ".png"],
  ["webp", WEBP, "image/webp", ".webp"],
])("accepts a %s capture from its bytes", async (_label, bytes, contentType, extension) => {
  await insertProduct({ id: "p01" });
  const response = await post({
    order: baseOrder(),
    capture: fileFrom(bytes, "pago.txt", "application/octet-stream"),
  });
  expect(response.status).toBe(201);
  const keys = await captureKeys();
  const key = keys[0];
  if (key === undefined) throw new Error("expected capture");
  expect(key.endsWith(extension)).toBe(true);
  const stored = await env.FILES.get(key);
  if (stored === null) throw new Error("expected object");
  expect(stored.httpMetadata?.contentType).toBe(contentType);
});

it("accepts a jpeg even when the Content-Type says text/plain", async () => {
  await insertProduct({ id: "p01" });
  const response = await post({
    order: baseOrder(),
    capture: fileFrom(JPEG, "pago.jpg", "text/plain"),
  });
  expect(response.status).toBe(201);
});

it("rejects a renamed text file even when the Content-Type says image/jpeg", async () => {
  await insertProduct({ id: "p01", stock: 4 });
  const response = await post({
    order: baseOrder(),
    capture: fileFrom(Uint8Array.from([0x68, 0x65, 0x6c, 0x6c, 0x6f]), "pago.jpg", "image/jpeg"),
  });
  expect(response.status).toBe(415);
  expect(await response.json()).toEqual(UNSUPPORTED);
  expect(await stockOf("p01")).toBe(4);
  expect(await captureKeys()).toEqual([]);
});

it("rejects a capture over 5 MB before looking at its type", async () => {
  await insertProduct({ id: "p01", stock: 4 });
  const bytes = new Uint8Array(5 * 1024 * 1024 + 1);
  bytes[0] = 0x68;
  const response = await post({
    order: baseOrder(),
    capture: fileFrom(bytes, "pago.jpg", "image/jpeg"),
  });
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual(FILE_TOO_LARGE);
  expect(await captureKeys()).toEqual([]);
  expect(await stockOf("p01")).toBe(4);
}, 20000);

it("accepts a capture of exactly 5 MB", async () => {
  await insertProduct({ id: "p01" });
  const bytes = new Uint8Array(5 * 1024 * 1024);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  const response = await post({
    order: baseOrder(),
    capture: fileFrom(bytes, "pago.jpg", "text/plain"),
  });
  expect(response.status).toBe(201);
}, 20000);

it("rejects a body over 6 MB", async () => {
  const response = await post({ orderText: "x".repeat(6 * 1024 * 1024 + 1) });
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual(FILE_TOO_LARGE);
}, 20000);

it("requires an Idempotency-Key UUID", async () => {
  await expectValidation(await post({ omitKey: true, order: baseOrder() }), [
    { path: "idempotency-key", message: "Idempotency-Key is required" },
  ]);
  await expectValidation(await post({ key: "no-es-uuid", order: baseOrder() }), [
    { path: "idempotency-key", message: "Idempotency-Key must be a UUID" },
  ]);
});

it.each(["999 111 222", "+51999111222", "99911122", "9991112222"])(
  "rejects phone %s",
  async (phone) => {
    await expectValidation(
      await post({
        order: baseOrder({ customer: { name: "Ana", phone, email: "ana@example.com" } }),
      }),
      [{ path: "customer.phone", message: "phone must be 9 digits" }],
    );
  },
);

it("rejects an invalid email, an empty customer name, and a 15 character item name", async () => {
  await expectValidation(
    await post({
      order: baseOrder({ customer: { name: "Ana", phone: "999111222", email: "ana@" } }),
    }),
    [{ path: "customer.email", message: "email is invalid" }],
  );
  await expectValidation(
    await post({ order: baseOrder({ customer: { name: "", phone: "999111222" } }) }),
    [{ path: "customer.name", message: "name must not be empty" }],
  );
  await expectValidation(
    await post({
      order: baseOrder({
        items: [{ productId: "p01", qty: 1, size: "clasica", name: "aaaaaaaaaaaaaaa" }],
      }),
    }),
    [{ path: "items.0.name", message: "name must be 1 to 14 characters" }],
  );
});

it("rejects an empty item list and a list of 21", async () => {
  await expectValidation(await post({ order: baseOrder({ items: [] }) }), [
    { path: "items", message: "items must contain 1 to 20 products" },
  ]);
  await expectValidation(
    await post({
      order: baseOrder({
        items: Array.from({ length: 21 }, () => ({ productId: "p01", qty: 1, size: "clasica" })),
      }),
    }),
    [{ path: "items", message: "items must contain 1 to 20 products" }],
  );
});

it.each([
  [0, "qty must be an integer from 1 to 20"],
  [21, "qty must be an integer from 1 to 20"],
  [1.5, "qty must be an integer from 1 to 20"],
])("rejects qty %s", async (qty) => {
  await expectValidation(
    await post({ order: baseOrder({ items: [{ productId: "p01", qty, size: "clasica" }] }) }),
    [{ path: "items.0.qty", message: "qty must be an integer from 1 to 20" }],
  );
});

it.each(["12345", "000000000000000", "12345a"])(
  "rejects yape operation %s",
  async (yapeOperation) => {
    await expectValidation(await post({ order: baseOrder({ yapeOperation }) }), [
      { path: "yapeOperation", message: "yapeOperation must be 6 to 14 digits" },
    ]);
  },
);

it("rejects a calendar date that does not exist", async () => {
  await expectValidation(await post({ order: baseOrder({ deliveryDate: "2026-02-30" }) }), [
    { path: "deliveryDate", message: "deliveryDate must be a real yyyy-MM-dd date" },
  ]);
});

it("rejects an empty or oversized card message and an oversized note", async () => {
  await expectValidation(
    await post({
      order: baseOrder({
        items: [{ productId: "p01", qty: 1, size: "clasica", card: { message: "" } }],
      }),
    }),
    [{ path: "items.0.card.message", message: "message must be 1 to 200 characters" }],
  );
  await expectValidation(
    await post({
      order: baseOrder({
        items: [{ productId: "p01", qty: 1, size: "clasica", card: { message: "a".repeat(201) } }],
      }),
    }),
    [{ path: "items.0.card.message", message: "message must be 1 to 200 characters" }],
  );
  await expectValidation(await post({ order: baseOrder({ note: "a".repeat(501) }) }), [
    { path: "note", message: "note must be at most 500 characters" },
  ]);
});

it("rejects an empty address or district", async () => {
  await expectValidation(
    await post({
      order: baseOrder({ delivery: { mode: "delivery", address: "   ", district: "San Juan" } }),
    }),
    [{ path: "delivery.address", message: "address must not be empty" }],
  );
  await expectValidation(
    await post({
      order: baseOrder({ delivery: { mode: "delivery", address: "Av. 1", district: "" } }),
    }),
    [{ path: "delivery.district", message: "district must not be empty" }],
  );
});

it("rejects order text that is not a JSON object", async () => {
  await expectValidation(await post({ orderText: "no-es-json" }), [
    { path: "order", message: "order must be JSON" },
  ]);
  await expectValidation(await post({ orderText: "[]" }), [
    { path: "order", message: "order must be an object" },
  ]);
  await expectValidation(await post({ orderText: "null" }), [
    { path: "order", message: "order must be an object" },
  ]);
});

it("rejects a missing order field or capture file", async () => {
  await expectValidation(await post({ omitOrder: true, omitCapture: true }), [
    { path: "order", message: "order must be a JSON string" },
    { path: "capture", message: "capture must be a file" },
  ]);
});

it.each([-1, 10.5])("rejects expectedTotalCents %s", async (expectedTotalCents) => {
  await expectValidation(await post({ order: baseOrder({ expectedTotalCents }) }), [
    { path: "expectedTotalCents", message: "expectedTotalCents must be a non-negative integer" },
  ]);
});

it("ignores extra JSON fields and still creates the order", async () => {
  await insertProduct({ id: "p01" });
  const response = await post({
    order: { ...baseOrder(), coupon: "gratis", customer: { ...baseOrder().customer, age: 30 } },
  });
  expect(response.status).toBe(201);
  expect(await orderCount()).toBe(1);
});

it("prices a large size with a card and wrapping", async () => {
  await insertProduct({
    id: "p01",
    name: "Caja",
    fields: ["nombre", "color", "tamano", "tarjeta", "envoltura"],
    priceCents: 4500,
    largeExtraCents: 1500,
  });
  const response = await post({
    order: baseOrder({
      expectedTotalCents: 14600,
      items: [
        {
          productId: "p01",
          qty: 2,
          size: "grande",
          name: "José",
          color: "oliva",
          card: { message: "Feliz día" },
          wrap: true,
        },
      ],
    }),
  });
  expect(response.status).toBe(201);
  const created = createdOrder(await response.json());
  expect(created.totalCents).toBe(14600);
  const row = record(
    await env.DB.prepare("SELECT unit_price_cents, qty, options FROM order_items").first(),
  );
  expect(row.unit_price_cents).toBe(7300);
  expect(row.qty).toBe(2);

  const body = record(await (await getOrder(created.code, created.token)).json());
  expect(body.items).toEqual([
    {
      productName: "Caja",
      qty: 2,
      options: ["Grande", "Nombre: José", "Color: oliva", "Envoltura"],
      cardMessage: "Feliz día",
      lineTotalCents: 14600,
    },
  ]);
  expect(body.subtotalCents).toBe(14600);
  expect(body.deliveryCostCents).toBe(0);
});

it("leaves delivery cost null when the mode is home delivery", async () => {
  await insertProduct({ id: "p01" });
  const response = await post({
    order: baseOrder({
      delivery: {
        mode: "delivery",
        address: "Av. Los Jardines 12",
        district: "San Juan",
        reference: "casa verde",
      },
    }),
  });
  expect(response.status).toBe(201);
  const created = createdOrder(await response.json());
  expect(created.totalCents).toBe(4500);
  const body = record(await (await getOrder(created.code, created.token)).json());
  expect(body.delivery).toEqual({
    mode: "delivery",
    address: "Av. Los Jardines 12",
    district: "San Juan",
    reference: "casa verde",
  });
  expect(body.deliveryCostCents).toBeNull();
});

it("does not charge wrap:false and does not require the wrapping field", async () => {
  await insertProduct({ id: "p01", fields: [] });
  const response = await post({
    order: baseOrder({ items: [{ productId: "p01", qty: 1, size: "clasica", wrap: false }] }),
  });
  expect(response.status).toBe(201);
  expect(createdOrder(await response.json()).totalCents).toBe(4500);
});

it.each([
  ["color", { color: "oliva" }, "items.0.color", "color is not available for this product"],
  ["name", { name: "Ana" }, "items.0.name", "name is not available for this product"],
  ["size", { size: "grande" }, "items.0.size", "size is not available for this product"],
  ["card", { card: { message: "Hola" } }, "items.0.card", "card is not available for this product"],
  ["wrap", { wrap: true }, "items.0.wrap", "wrap is not available for this product"],
])("rejects an inactive %s option", async (_label, extra, path, message) => {
  await insertProduct({ id: "p01", fields: [] });
  const response = await post({
    order: baseOrder({ items: [{ productId: "p01", qty: 1, size: "clasica", ...extra }] }),
  });
  await expectValidation(response, [{ path, message }]);
});

it("reports hidden and missing products and does not repeat ids", async () => {
  await insertProduct({ id: "hidden", active: 0, stock: 5 });
  const response = await post({
    order: baseOrder({
      items: [
        { productId: "missing", qty: 1, size: "clasica" },
        { productId: "hidden", qty: 1, size: "clasica" },
        { productId: "missing", qty: 1, size: "clasica" },
      ],
    }),
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: {
      code: "product_unavailable",
      message: "Product is unavailable",
      details: { productIds: ["missing", "hidden"] },
    },
  });
  expect(await captureKeys()).toEqual([]);
});

it("rejects a changed price and leaves stock and storage untouched", async () => {
  await insertProduct({ id: "p01", stock: 4 });
  const response = await post({ order: baseOrder({ expectedTotalCents: 1 }) });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: { code: "price_changed", message: "Price changed", details: { totalCents: 4500 } },
  });
  expect(await stockOf("p01")).toBe(4);
  expect(await captureKeys()).toEqual([]);
  expect(await orderCount()).toBe(0);
});

it("rejects a delivery date before the minimum and accepts the minimum", async () => {
  await insertProduct({ id: "p01", prepDays: 5, stock: 3 });
  const today = limaToday(new Date());
  const early = await post({ order: baseOrder({ deliveryDate: addDays(today, 4) }) });
  expect(early.status).toBe(422);
  expect(await early.json()).toEqual(TOO_SOON);
  expect(await stockOf("p01")).toBe(3);

  const onTime = await post({ order: baseOrder({ deliveryDate: addDays(today, 5) }) });
  expect(onTime.status).toBe(201);
});

it("keeps the three day floor when every product is faster", async () => {
  await insertProduct({ id: "p01", prepDays: 1, stock: 3 });
  const today = limaToday(new Date());
  const early = await post({ order: baseOrder({ deliveryDate: addDays(today, 2) }) });
  expect(early.status).toBe(422);
  expect(await early.json()).toEqual(TOO_SOON);
  const onTime = await post({ order: baseOrder({ deliveryDate: addDays(today, 3) }) });
  expect(onTime.status).toBe(201);
});

it("rejects the summed quantity when one product is short and uploads nothing", async () => {
  await insertProduct({ id: "ok", stock: 5, priceCents: 4500 });
  await insertProduct({ id: "short", stock: 1, priceCents: 4500 });
  const response = await post({
    order: baseOrder({
      expectedTotalCents: 13500,
      items: [
        { productId: "ok", qty: 1, size: "clasica" },
        { productId: "short", qty: 2, size: "clasica" },
      ],
    }),
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: {
      code: "out_of_stock",
      message: "Not enough stock",
      details: { productIds: ["short"] },
    },
  });
  expect(await captureKeys()).toEqual([]);
  expect(await stockOf("ok")).toBe(5);
});

it("sums two lines of the same product and sells the last units", async () => {
  await insertProduct({ id: "p01", stock: 3 });
  const over = await post({
    order: baseOrder({
      expectedTotalCents: 18000,
      items: [
        { productId: "p01", qty: 2, size: "clasica" },
        { productId: "p01", qty: 2, size: "clasica" },
      ],
    }),
  });
  expect(over.status).toBe(409);
  expect(await over.json()).toEqual({
    error: { code: "out_of_stock", message: "Not enough stock", details: { productIds: ["p01"] } },
  });

  await reset();
  await insertProduct({ id: "p01", stock: 3, fields: ["tamano"] });
  const exact = await post({
    order: baseOrder({
      expectedTotalCents: 16500,
      items: [
        { productId: "p01", qty: 1, size: "clasica" },
        { productId: "p01", qty: 2, size: "grande" },
      ],
    }),
  });
  expect(exact.status).toBe(201);
  expect(createdOrder(await exact.json()).totalCents).toBe(16500);
  expect(await stockOf("p01")).toBe(0);
});

it("returns the same code on retry, rotates the token, and does not sell twice", async () => {
  await insertProduct({ id: "p01", stock: 1 });
  const key = crypto.randomUUID();
  const text = JSON.stringify(baseOrder());
  const capture = fileFrom(JPEG, "pago.jpg", "image/jpeg");
  const first = await post({ orderText: text, capture, key });
  expect(first.status).toBe(201);
  const created = createdOrder(await first.json());

  const second = await post({
    orderText: text,
    capture: fileFrom(JPEG, "pago.jpg", "image/jpeg"),
    key,
  });
  expect(second.status).toBe(200);
  const replayed = createdOrder(await second.json());
  expect(replayed.code).toBe(created.code);
  expect(replayed.totalCents).toBe(created.totalCents);
  expect(replayed.token).not.toBe(created.token);
  expect(await stockOf("p01")).toBe(0);
  expect(await orderCount()).toBe(1);
  expect(await captureKeys()).toHaveLength(1);
  expect((await getOrder(created.code, created.token)).status).toBe(404);
  expect((await getOrder(replayed.code, replayed.token)).status).toBe(200);
});

it("rejects the same idempotency key when the order text changes", async () => {
  await insertProduct({ id: "p01", stock: 4 });
  const key = crypto.randomUUID();
  const first = await post({ order: baseOrder(), key });
  expect(first.status).toBe(201);
  const second = await post({ order: baseOrder({ note: "otro texto" }), key });
  expect(second.status).toBe(409);
  expect(await second.json()).toEqual(CONFLICT);
  expect(await stockOf("p01")).toBe(3);
  expect(await orderCount()).toBe(1);
  expect(await captureKeys()).toHaveLength(1);
});

it("rejects the same idempotency key when the capture bytes change", async () => {
  await insertProduct({ id: "p01", stock: 4 });
  const key = crypto.randomUUID();
  const text = JSON.stringify(baseOrder());
  const first = await post({
    orderText: text,
    capture: fileFrom(JPEG, "a.jpg", "image/jpeg"),
    key,
  });
  expect(first.status).toBe(201);
  const other = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
  const second = await post({
    orderText: text,
    capture: fileFrom(other, "b.jpg", "image/jpeg"),
    key,
  });
  expect(second.status).toBe(409);
  expect(await second.json()).toEqual(CONFLICT);
  expect(await captureKeys()).toHaveLength(1);
});

it("lets only one of two parallel orders take the last unit", async () => {
  await insertProduct({ id: "p01", stock: 1 });
  const text = JSON.stringify(baseOrder());
  const [left, right] = await Promise.all([
    post({ orderText: text, key: crypto.randomUUID() }),
    post({ orderText: text, key: crypto.randomUUID() }),
  ]);
  const statuses = [left.status, right.status].sort((a, b) => a - b);
  expect(statuses).toEqual([201, 409]);
  const failed = left.status === 409 ? left : right;
  expect(await failed.json()).toEqual({
    error: { code: "out_of_stock", message: "Not enough stock", details: { productIds: ["p01"] } },
  });
  expect(await stockOf("p01")).toBe(0);
  expect(await orderCount()).toBe(1);
  expect(await captureKeys()).toHaveLength(1);
});

it("keeps one order when the same idempotency key arrives in parallel", async () => {
  await insertProduct({ id: "p01", stock: 5 });
  const key = crypto.randomUUID();
  const text = JSON.stringify(baseOrder());
  const [left, right] = await Promise.all([
    post({ orderText: text, key }),
    post({ orderText: text, key }),
  ]);
  const statuses = [left.status, right.status].sort((a, b) => a - b);
  expect(statuses).toEqual([200, 201]);
  const created = createdOrder(await left.json());
  const other = createdOrder(await right.json());
  expect(other.code).toBe(created.code);
  expect(await orderCount()).toBe(1);
  expect(await stockOf("p01")).toBe(4);
  expect(await captureKeys()).toHaveLength(1);
  const replayed = left.status === 200 ? created : other;
  expect((await getOrder(replayed.code, replayed.token)).status).toBe(200);
});

it("deletes the capture when the batch fails", async () => {
  await insertProduct({ id: "p01", stock: 4 });
  const db = new Proxy(env.DB, {
    get(target, property, receiver) {
      if (property === "batch") return () => Promise.reject(new Error("forced batch failure"));
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const response = await post({ order: baseOrder(), db });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: { code: "internal_error", message: "Internal Server Error" },
  });
  expect(await captureKeys()).toEqual([]);
  expect(await stockOf("p01")).toBe(4);
  expect(await orderCount()).toBe(0);
});

it("returns the same 404 for a bad token, a missing token, a weird code, and an unknown code", async () => {
  await insertProduct({ id: "p01" });
  const created = createdOrder(await (await post({ order: baseOrder() })).json());
  const responses = await Promise.all([
    getOrder(created.code, "token-malo"),
    getOrder(created.code),
    getOrder("nope"),
    getOrder("REG-2026-12"),
    getOrder("reg-2026-0001"),
    getOrder("REG-2026-9999"),
    app.request(
      `/orders/${created.code}?t=${encodeURIComponent(created.token)}`,
      {},
      {
        DB: env.DB,
        FILES: env.FILES,
      },
    ),
  ]);
  const bodies = await Promise.all(responses.map(async (response) => response.json()));
  for (const response of responses) expect(response.status).toBe(404);
  for (const body of bodies) expect(body).toEqual(ORDER_NOT_FOUND);
});

it("loads the lines of an order with one query", async () => {
  await insertProduct({ id: "p01", name: "Uno", priceCents: 1000, fields: ["tamano"] });
  await insertProduct({ id: "p02", name: "Dos", priceCents: 2000 });
  const createdResponse = await post({
    order: baseOrder({
      expectedTotalCents: 4500,
      items: [
        { productId: "p01", qty: 1, size: "grande" },
        { productId: "p02", qty: 1, size: "clasica" },
      ],
    }),
  });
  const created = createdOrder(await createdResponse.json());
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
  const response = await getOrder(created.code, created.token, db);
  expect(response.status).toBe(200);
  const body = record(await response.json());
  expect(body.items).toEqual([
    { productName: "Uno", qty: 1, options: ["Grande"], cardMessage: null, lineTotalCents: 2500 },
    { productName: "Dos", qty: 1, options: ["Clásica"], cardMessage: null, lineTotalCents: 2000 },
  ]);
  expect(sql.filter((query) => query.includes("order_items"))).toHaveLength(1);
  expect(sql.filter((query) => query.includes("FROM orders"))).toHaveLength(1);
});
