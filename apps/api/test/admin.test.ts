import { env } from "cloudflare:workers";
import { hc } from "hono/client";
import { beforeEach, expect, it } from "vitest";
import { commitStatus } from "../src/admin/queries";
import app from "../src/index";
import { addDays, limaToday, orderCode, orderIdFromCode } from "../src/orders/logic";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  bindings,
  hs384Token,
  loginToken,
  SESSION_SECRET,
  sessionToken,
  shapedToken,
  unsignedToken,
} from "./session";

const UNAUTHORIZED = { error: { code: "unauthorized", message: "Unauthorized" } };
const INVALID_CREDENTIALS = {
  error: { code: "invalid_credentials", message: "Invalid email or password" },
};
const PAYLOAD_TOO_LARGE = { error: { code: "payload_too_large", message: "Payload is too large" } };
const NOT_FOUND = { error: { code: "order_not_found", message: "Order not found" } };
const INVALID = { error: { code: "invalid_transition", message: "Invalid transition" } };
const INTERNAL = { error: { code: "internal_error", message: "Internal Server Error" } };
const STATUSES = [
  "por_verificar",
  "confirmado",
  "en_preparacion",
  "listo",
  "entregado",
  "rechazado",
];
const VALID: Record<string, readonly string[]> = {
  por_verificar: ["confirmado", "rechazado"],
  confirmado: ["en_preparacion"],
  en_preparacion: ["listo"],
  listo: ["entregado"],
  entregado: [],
  rechazado: [],
};

const transitions = STATUSES.flatMap((from) =>
  STATUSES.map((to) => ({ from, to, ok: (VALID[from] ?? []).includes(to) })),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("expected object");
  return value;
}

function adminFetch(
  path: string,
  options: {
    method?: string;
    token?: string;
    json?: unknown;
    env?: ReturnType<typeof bindings>;
  } = {},
) {
  const headers = new Headers();
  if (options.token !== undefined) headers.set("Authorization", `Bearer ${options.token}`);
  const method = options.method ?? "GET";
  if (options.json !== undefined) headers.set("content-type", "application/json");
  const init =
    options.json === undefined
      ? { method, headers }
      : { method, headers, body: JSON.stringify(options.json) };
  return app.request(path, init, options.env ?? bindings());
}

async function reset(): Promise<void> {
  await env.DB.prepare("DELETE FROM order_items").run();
  await env.DB.prepare("DELETE FROM orders").run();
  await env.DB.prepare("DELETE FROM product_photos").run();
  await env.DB.prepare("DELETE FROM products").run();
  const listed = await env.FILES.list();
  await Promise.all(listed.objects.map((object) => env.FILES.delete(object.key)));
}

async function insertProduct(input: {
  id: string;
  name?: string;
  stock?: number;
  active?: number;
}): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO products (
      id, slug, name, price_cents, old_price_cents, stock, prep_days, description,
      fields, occasions, tag, size_classic, size_large, large_extra_cents, active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.id,
      input.id,
      input.name ?? input.id,
      4500,
      null,
      input.stock ?? 8,
      2,
      "Flores",
      "[]",
      "[]",
      null,
      "Clásica",
      "Grande",
      1500,
      input.active ?? 1,
      "2026-11-18T12:00:00.000-05:00",
    )
    .run();
}

async function insertOrder(
  input: {
    status?: string;
    name?: string;
    phone?: string;
    email?: string | null;
    createdAt?: string;
    deliveryDate?: string;
    subtotal?: number;
    deliveryCost?: number | null;
    verifiedAt?: string | null;
    deliveredAt?: string | null;
    rejectedAt?: string | null;
    note?: string | null;
    captureKey?: string;
    items?: { productId: string; name: string; qty: number; unit?: number }[];
  } = {},
): Promise<{ id: number; code: string }> {
  const today = limaToday(new Date());
  const createdAt = input.createdAt ?? `${today}T12:00:00.000-05:00`;
  const raw = await env.DB.prepare(
    `INSERT INTO orders (
      idempotency_key, request_hash, token_hash, status,
      customer_name, phone, email,
      delivery_mode, station, slot, address, district, reference,
      delivery_date, note, subtotal_cents, delivery_cost_cents,
      yape_operation, capture_key, created_at, verified_at, delivered_at, rejected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'estacion', 'Bayóvar', 'manana', NULL, NULL, NULL, ?, ?, ?, ?, '123456', ?, ?, ?, ?, ?)
    RETURNING id`,
  )
    .bind(
      crypto.randomUUID(),
      "hash",
      "token",
      input.status ?? "por_verificar",
      input.name ?? "María Ñoño",
      input.phone ?? "999111222",
      input.email === undefined ? "ana@example.com" : input.email,
      input.deliveryDate ?? addDays(today, 3),
      input.note === undefined ? null : input.note,
      input.subtotal ?? 4500,
      input.deliveryCost === undefined ? 0 : input.deliveryCost,
      input.captureKey ?? `captures/${crypto.randomUUID()}.jpg`,
      createdAt,
      input.verifiedAt === undefined ? null : input.verifiedAt,
      input.deliveredAt === undefined ? null : input.deliveredAt,
      input.rejectedAt === undefined ? null : input.rejectedAt,
    )
    .first();
  const id = record(raw).id;
  if (typeof id !== "number") throw new Error("expected id");
  let itemId = id * 100;
  for (const item of input.items ?? []) {
    await env.DB.prepare(
      `INSERT INTO order_items (id, order_id, product_id, product_name, qty, unit_price_cents, options)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        itemId,
        id,
        item.productId,
        item.name,
        item.qty,
        item.unit ?? 1000,
        JSON.stringify({ size: "clasica" }),
      )
      .run();
    itemId += 1;
  }
  return { id, code: orderCode(createdAt, id) };
}

async function stockOf(id: string): Promise<number> {
  const raw = await env.DB.prepare("SELECT stock FROM products WHERE id = ?").bind(id).first();
  const stock = record(raw).stock;
  if (typeof stock !== "number") throw new Error("expected stock");
  return stock;
}

async function statusOf(code: string): Promise<string> {
  const id = orderIdFromCode(code);
  const raw = await env.DB.prepare("SELECT status FROM orders WHERE id = ?").bind(id).first();
  const status = record(raw).status;
  if (typeof status !== "string") throw new Error("expected status");
  return status;
}

function watchLogs(): { text: () => string; restore: () => void } {
  const lines: string[] = [];
  const original = { error: console.error, warn: console.warn };
  const push = (...args: unknown[]) => {
    lines.push(
      args.map((value) => (typeof value === "string" ? value : JSON.stringify(value))).join(" "),
    );
  };
  console.error = push;
  console.warn = push;
  return {
    text: () => lines.join("\n"),
    restore: () => {
      console.error = original.error;
      console.warn = original.warn;
    },
  };
}

function requestWithAuthorization(path: string, value: string): Request {
  const request = new Request(`http://example.com${path}`);
  const headers = {
    get(name: string): string | null {
      if (name.toLowerCase() === "authorization") return value;
      return request.headers.get(name);
    },
    has(name: string): boolean {
      if (name.toLowerCase() === "authorization") return true;
      return request.headers.has(name);
    },
    forEach(callback: (value: string, key: string) => void): void {
      request.headers.forEach(callback);
      callback(value, "authorization");
    },
  };
  return new Proxy(request, {
    get(target, prop) {
      if (prop === "headers") return headers;
      const current = Reflect.get(target, prop, target);
      return typeof current === "function" ? current.bind(target) : current;
    },
  });
}

function postLogin(body: string, envBindings: ReturnType<typeof bindings> = bindings()) {
  return app.request(
    "/admin/login",
    { method: "POST", headers: { "content-type": "application/json" }, body },
    envBindings,
  );
}

beforeEach(async () => {
  await reset();
});

it("exposes POST /admin/login and GET /admin/me on the app client", () => {
  const client = hc<typeof app>("http://gift-shop.test");
  expect(typeof client.admin.login.$post).toBe("function");
  expect(typeof client.admin.me.$get).toBe("function");
});

it("logs in with a mixed-case email surrounded by spaces", async () => {
  const logs = watchLogs();
  const envBindings = bindings({ ADMIN_EMAIL: "MartinezYashira8@gmail.com" });
  try {
    const response = await postLogin(
      JSON.stringify({ email: "  MartinezYashira8@GMAIL.com  ", password: ADMIN_PASSWORD }),
      envBindings,
    );
    expect(response.status).toBe(200);
    const body = record(await response.json());
    expect(body.email).toBe("martinezyashira8@gmail.com");
    const token = body.token;
    const expiresAt = body.expiresAt;
    if (typeof token !== "string" || typeof expiresAt !== "string")
      throw new Error("expected session");
    expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const lifetime = Date.parse(expiresAt) - Date.now();
    expect(lifetime).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(lifetime).toBeLessThan(7 * 24 * 60 * 60 * 1000 + 60_000);
    const me = await app.request(
      "/admin/me",
      { headers: { Authorization: `Bearer ${token}` } },
      envBindings,
    );
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ email: "martinezyashira8@gmail.com" });
    expect(JSON.stringify(body)).not.toContain(ADMIN_PASSWORD);
    expect(logs.text()).not.toContain(ADMIN_PASSWORD);
    expect(logs.text()).not.toContain(token);
  } finally {
    logs.restore();
  }
});

it("does not trim spaces around the password", async () => {
  const envBindings = bindings({ ADMIN_PASSWORD: "  clave  " });
  const exact = await postLogin(
    JSON.stringify({ email: ADMIN_EMAIL, password: "  clave  " }),
    envBindings,
  );
  expect(exact.status).toBe(200);
  const trimmed = await postLogin(
    JSON.stringify({ email: ADMIN_EMAIL, password: "clave" }),
    envBindings,
  );
  expect(trimmed.status).toBe(401);
  expect(await trimmed.json()).toEqual(INVALID_CREDENTIALS);
});

it("accepts a password with accents and emoji", async () => {
  const password = "señal-🎁";
  const logs = watchLogs();
  try {
    const response = await postLogin(
      JSON.stringify({ email: ADMIN_EMAIL, password }),
      bindings({ ADMIN_PASSWORD: password }),
    );
    expect(response.status).toBe(200);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain(password);
    expect(logs.text()).not.toContain(password);
  } finally {
    logs.restore();
  }
});

it("rejects a wrong email without saying which field failed", async () => {
  const logs = watchLogs();
  try {
    const response = await postLogin(
      JSON.stringify({ email: "otra@example.com", password: ADMIN_PASSWORD }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(INVALID_CREDENTIALS);
    expect(logs.text()).not.toContain(ADMIN_PASSWORD);
  } finally {
    logs.restore();
  }
});

it("rejects a wrong password without saying which field failed", async () => {
  const password = "clave-no-loguear-ñ";
  const logs = watchLogs();
  try {
    const response = await postLogin(JSON.stringify({ email: ADMIN_EMAIL, password }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(INVALID_CREDENTIALS);
    expect(logs.text()).not.toContain(password);
  } finally {
    logs.restore();
  }
});

it("rejects an empty email", async () => {
  const response = await postLogin(JSON.stringify({ email: "", password: ADMIN_PASSWORD }));
  expect(response.status).toBe(422);
  expect(record(record(await response.json()).error).code).toBe("validation_error");
});

it("rejects an email that is only spaces", async () => {
  const response = await postLogin(JSON.stringify({ email: "   ", password: ADMIN_PASSWORD }));
  expect(response.status).toBe(422);
  expect(record(record(await response.json()).error).code).toBe("validation_error");
});

it("rejects an empty password", async () => {
  const response = await postLogin(JSON.stringify({ email: ADMIN_EMAIL, password: "" }));
  expect(response.status).toBe(422);
  expect(record(record(await response.json()).error).code).toBe("validation_error");
});

it("rejects an email longer than 254 characters", async () => {
  const response = await postLogin(
    JSON.stringify({ email: `${"a".repeat(250)}@b.co`, password: ADMIN_PASSWORD }),
  );
  expect(response.status).toBe(422);
  expect(record(record(await response.json()).error).code).toBe("validation_error");
});

it("rejects a password longer than 200 characters", async () => {
  const response = await postLogin(
    JSON.stringify({ email: ADMIN_EMAIL, password: "p".repeat(201) }),
  );
  expect(response.status).toBe(422);
  expect(record(record(await response.json()).error).code).toBe("validation_error");
});

it("rejects broken JSON", async () => {
  const response = await postLogin("{");
  expect(response.status).toBe(422);
  expect(record(record(await response.json()).error).code).toBe("validation_error");
});

it("rejects an empty login body even when session secrets are missing", async () => {
  const response = await postLogin("", bindings({ omitPassword: true, omitSecret: true }));
  expect(response.status).toBe(422);
  expect(record(record(await response.json()).error).code).toBe("validation_error");
});

it("rejects a login body larger than 4 KB", async () => {
  const body = JSON.stringify({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    padding: "x".repeat(5000),
  });
  expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(4096);
  const response = await postLogin(body);
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual(PAYLOAD_TOO_LARGE);
});

it("GET /admin/me without a header is 401", async () => {
  const response = await adminFetch("/admin/me");
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("GET /admin/summary without a header is 401", async () => {
  const response = await adminFetch("/admin/summary");
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("rejects a basic authorization header", async () => {
  const response = await app.request(
    "/admin/me",
    { headers: { Authorization: "Basic abc" } },
    bindings(),
  );
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("rejects a bearer scheme without a separating space", async () => {
  const response = await app.request(
    "/admin/me",
    { headers: { Authorization: "Bearer" } },
    bindings(),
  );
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("rejects an empty bearer token", async () => {
  const response = await app.request(
    "/admin/me",
    { headers: { Authorization: "Bearer " } },
    bindings(),
  );
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("rejects a bearer token that contains a newline", async () => {
  const token = await loginToken();
  const logs = watchLogs();
  try {
    const response = await app.request(
      requestWithAuthorization("/admin/me", `Bearer ${token}\n`),
      undefined,
      bindings(),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(UNAUTHORIZED);
    expect(logs.text()).not.toContain(token);
  } finally {
    logs.restore();
  }
});

it("rejects a garbage bearer token and does not log it", async () => {
  const logs = watchLogs();
  try {
    const response = await adminFetch("/admin/summary", { token: "jwt-secreto-no-loguear" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(UNAUTHORIZED);
    expect(logs.text()).not.toContain("jwt-secreto-no-loguear");
  } finally {
    logs.restore();
  }
});

it("rejects a token signed with another secret and does not log it", async () => {
  const logs = watchLogs();
  const token = await sessionToken("y".repeat(32));
  try {
    const response = await adminFetch("/admin/me", { token });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(UNAUTHORIZED);
    expect(logs.text()).not.toContain(token);
  } finally {
    logs.restore();
  }
});

it("rejects a token with alg none", async () => {
  const response = await adminFetch("/admin/me", { token: unsignedToken() });
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("rejects a token with alg HS384", async () => {
  const response = await adminFetch("/admin/me", { token: await hs384Token(SESSION_SECRET) });
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("rejects an expired session token", async () => {
  const now = Math.floor(Date.now() / 1000);
  const response = await adminFetch("/admin/me", {
    token: await sessionToken(SESSION_SECRET, { exp: now - 10, iat: now - 120 }),
  });
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("rejects a token with a different issuer", async () => {
  const response = await adminFetch("/admin/me", {
    token: await sessionToken(SESSION_SECRET, { iss: "other-issuer" }),
  });
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("rejects a token whose subject is not the admin", async () => {
  const response = await adminFetch("/admin/summary", {
    token: await sessionToken(SESSION_SECRET, { sub: "otra@example.com" }),
  });
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("returns 500 when the session secret is missing for a real-looking token", async () => {
  const token = shapedToken();
  const logs = watchLogs();
  try {
    const response = await adminFetch("/admin/me", { token, env: bindings({ omitSecret: true }) });
    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(JSON.parse(text)).toEqual(INTERNAL);
    expect(text).not.toContain("ADMIN_SESSION_SECRET");
    expect(text).not.toContain(token);
    expect(logs.text()).not.toContain(token);
  } finally {
    logs.restore();
  }
});

it("returns 401 for a non-jwt bearer when the session secret is missing", async () => {
  const response = await adminFetch("/admin/me", {
    token: "basura",
    env: bindings({ omitSecret: true }),
  });
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("returns 500 when the session secret is shorter than 32 characters", async () => {
  const secret = "s".repeat(31);
  const token = await sessionToken("b".repeat(32));
  const response = await adminFetch("/admin/me", {
    token,
    env: bindings({ ADMIN_SESSION_SECRET: secret }),
  });
  expect(response.status).toBe(500);
  const text = JSON.stringify(await response.json());
  expect(JSON.parse(text)).toEqual(INTERNAL);
  expect(text).not.toContain(secret);
  expect(text).not.toContain(token);
});

it("returns 500 when ADMIN_EMAIL is blank", async () => {
  const token = await sessionToken(SESSION_SECRET);
  const response = await adminFetch("/admin/me", {
    token,
    env: bindings({ ADMIN_EMAIL: "  " }),
  });
  expect(response.status).toBe(500);
  const text = JSON.stringify(await response.json());
  expect(JSON.parse(text)).toEqual(INTERNAL);
  expect(text).not.toContain("ADMIN_EMAIL");
  expect(text).not.toContain(token);
});

it("returns 500 when ADMIN_PASSWORD is missing on login", async () => {
  const password = "clave-no-loguear";
  const logs = watchLogs();
  try {
    const response = await postLogin(
      JSON.stringify({ email: ADMIN_EMAIL, password }),
      bindings({ omitPassword: true }),
    );
    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(JSON.parse(text)).toEqual(INTERNAL);
    expect(text).not.toContain("ADMIN_PASSWORD");
    expect(text).not.toContain(password);
    expect(logs.text()).not.toContain(password);
  } finally {
    logs.restore();
  }
});

it("returns 500 when ADMIN_PASSWORD is empty on login", async () => {
  const response = await postLogin(
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    bindings({ ADMIN_PASSWORD: "" }),
  );
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual(INTERNAL);
});

it("returns 500 when the session secret is missing on login", async () => {
  const response = await postLogin(
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    bindings({ omitSecret: true }),
  );
  expect(response.status).toBe(500);
  const text = JSON.stringify(await response.json());
  expect(JSON.parse(text)).toEqual(INTERNAL);
  expect(text).not.toContain(SESSION_SECRET);
  expect(text).not.toContain(ADMIN_PASSWORD);
});

it("returns 500 when the session secret is short on login", async () => {
  const secret = "short-secret";
  const response = await postLogin(
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    bindings({ ADMIN_SESSION_SECRET: secret }),
  );
  expect(response.status).toBe(500);
  const text = JSON.stringify(await response.json());
  expect(JSON.parse(text)).toEqual(INTERNAL);
  expect(text).not.toContain(secret);
});

it("an unknown admin path still requires a session", async () => {
  const missing = await adminFetch("/admin/no-existe");
  expect(missing.status).toBe(401);
  const token = await loginToken();
  const response = await adminFetch("/admin/no-existe", { token });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: { code: "not_found", message: "Not Found" } });
});

it("GET /admin/summary counts Lima today, the week, pending, upcoming and low stock", async () => {
  const today = limaToday(new Date());
  const weekStart = addDays(today, -6);
  await insertProduct({ id: "cuatro", name: "Cuatro", stock: 4 });
  await insertProduct({ id: "cero", name: "Cero", stock: 0 });
  await insertProduct({ id: "tres", name: "Tres", stock: 3 });
  await insertProduct({ id: "oculto", name: "Oculto", stock: 1, active: 0 });
  await insertProduct({ id: "taza", name: "Taza", stock: 10 });
  await insertProduct({ id: "mix", name: "Mix", stock: 10 });

  await insertOrder({
    name: "Ayer",
    createdAt: `${addDays(today, -1)}T23:59:59.999-05:00`,
    deliveryDate: addDays(today, -1),
  });
  const primera = await insertOrder({
    name: "Primera",
    createdAt: `${today}T10:00:00.000-05:00`,
    deliveryDate: today,
    items: [
      { productId: "taza", name: "Taza", qty: 2 },
      { productId: "mix", name: "Mix de flores", qty: 1 },
    ],
  });
  const segunda = await insertOrder({
    name: "Segunda",
    createdAt: `${today}T11:00:00.000-05:00`,
    deliveryDate: addDays(today, 1),
  });
  const tercera = await insertOrder({
    name: "Tercera",
    createdAt: `${today}T12:00:00.000-05:00`,
    deliveryDate: addDays(today, 2),
  });
  await insertOrder({
    name: "Cuarta",
    createdAt: `${today}T13:00:00.000-05:00`,
    deliveryDate: addDays(today, 3),
  });
  await insertOrder({
    name: "Quinta",
    createdAt: `${today}T14:00:00.000-05:00`,
    deliveryDate: addDays(today, 4),
  });
  await insertOrder({
    name: "Sexta",
    createdAt: `${today}T15:00:00.000-05:00`,
    deliveryDate: addDays(today, 5),
  });
  await insertOrder({
    status: "confirmado",
    name: "Semana",
    createdAt: `${weekStart}T01:00:00.000-05:00`,
    verifiedAt: `${weekStart}T00:00:00.000-05:00`,
    subtotal: 1000,
    deliveryCost: 0,
    deliveryDate: addDays(today, 9),
  });
  await insertOrder({
    status: "confirmado",
    name: "Hoy venta",
    createdAt: `${today}T08:00:00.000-05:00`,
    verifiedAt: `${today}T08:00:00.000-05:00`,
    subtotal: 2500,
    deliveryCost: null,
    deliveryDate: addDays(today, 8),
  });
  await insertOrder({
    status: "confirmado",
    name: "Vieja",
    createdAt: `${addDays(today, -8)}T12:00:00.000-05:00`,
    verifiedAt: `${addDays(today, -7)}T23:59:59.999-05:00`,
    subtotal: 50,
    deliveryDate: addDays(today, 8),
  });
  await insertOrder({
    status: "rechazado",
    name: "Rechazada",
    createdAt: `${addDays(today, -1)}T08:00:00.000-05:00`,
    verifiedAt: `${today}T09:00:00.000-05:00`,
    rejectedAt: `${today}T09:30:00.000-05:00`,
    subtotal: 9999,
    deliveryDate: today,
  });
  await insertOrder({
    status: "entregado",
    name: "Entregada",
    createdAt: `${today}T09:00:00.000-05:00`,
    verifiedAt: `${today}T09:00:00.000-05:00`,
    deliveredAt: `${today}T18:00:00.000-05:00`,
    subtotal: 100,
    deliveryDate: today,
  });

  const response = await adminFetch("/admin/summary", { token: await loginToken() });
  expect(response.status).toBe(200);
  const body = record(await response.json());
  expect(body.newToday).toBe(8);
  expect(body.toVerify).toBe(7);
  expect(body.weekVerifiedSalesCents).toBe(3600);
  const pending = body.pending;
  const upcoming = body.upcoming;
  if (!Array.isArray(pending) || !Array.isArray(upcoming)) throw new Error("expected lists");
  expect(pending.map((row) => record(row).customerName)).toEqual([
    "Ayer",
    "Primera",
    "Segunda",
    "Tercera",
    "Cuarta",
  ]);
  expect(record(pending[1]).itemsShort).toBe("Taza ×2, Mix de flores");
  expect(record(pending[1]).code).toBe(primera.code);
  expect(upcoming.map((row) => record(row).code)).toEqual([
    primera.code,
    segunda.code,
    tercera.code,
  ]);
  expect(body.lowStock).toEqual([
    { id: "cero", name: "Cero", stock: 0 },
    { id: "oculto", name: "Oculto", stock: 1 },
    { id: "tres", name: "Tres", stock: 3 },
  ]);
});

it("GET /admin/orders paginates by descending id with an opaque cursor", async () => {
  const first = await insertOrder({ name: "Uno" });
  const second = await insertOrder({ name: "Dos" });
  const third = await insertOrder({ name: "Tres" });
  const token = await loginToken();
  const page = await adminFetch("/admin/orders?limit=2", { token });
  expect(page.status).toBe(200);
  const body = record(await page.json());
  const items = body.items;
  if (!Array.isArray(items)) throw new Error("expected items");
  expect(items.map((row) => record(row).code)).toEqual([third.code, second.code]);
  const cursor = body.nextCursor;
  if (typeof cursor !== "string") throw new Error("expected cursor");
  expect(cursor).not.toBe(String(second.id));
  const next = await adminFetch(`/admin/orders?limit=2&cursor=${cursor}`, { token });
  const nextBody = record(await next.json());
  const nextItems = nextBody.items;
  if (!Array.isArray(nextItems)) throw new Error("expected items");
  expect(nextItems.map((row) => record(row).code)).toEqual([first.code]);
  expect(nextBody.nextCursor).toBeNull();
});

it("GET /admin/orders defaults to 20", async () => {
  for (let n = 0; n < 21; n += 1) await insertOrder({ name: `N${n}` });
  const response = await adminFetch("/admin/orders", { token: await loginToken() });
  const body = record(await response.json());
  const items = body.items;
  if (!Array.isArray(items)) throw new Error("expected items");
  expect(items).toHaveLength(20);
  expect(typeof body.nextCursor).toBe("string");
});

it.each([
  ["0", "limit"],
  ["51", "limit"],
  ["-1", "limit"],
  ["1.5", "limit"],
  ["nope", "status"],
  ["%%%", "cursor"],
])("GET /admin/orders rejects %s (%s)", async (value, field) => {
  const response = await adminFetch(`/admin/orders?${field}=${encodeURIComponent(value)}`, {
    token: await loginToken(),
  });
  expect(response.status).toBe(422);
  const body = record(await response.json());
  expect(record(body.error).code).toBe("validation_error");
});

it("filters orders by status", async () => {
  await insertOrder({ name: "Pendiente" });
  const ready = await insertOrder({
    name: "Listo",
    status: "listo",
    verifiedAt: `${limaToday(new Date())}T08:00:00.000-05:00`,
  });
  const response = await adminFetch("/admin/orders?status=listo", { token: await loginToken() });
  const body = record(await response.json());
  const items = body.items;
  if (!Array.isArray(items)) throw new Error("expected items");
  expect(items.map((row) => record(row).code)).toEqual([ready.code]);
});

it("q matches a name with % _ quotes tildes emoji or 200 characters, and an exact code", async () => {
  await insertProduct({ id: "p", name: "P" });
  const percent = await insertOrder({ name: "100% off" });
  await insertOrder({ name: "100X off" });
  const underscore = await insertOrder({ name: "a_b" });
  await insertOrder({ name: "axb" });
  const quoted = await insertOrder({ name: `Ana "O'Hara"` });
  const accented = await insertOrder({ name: "María Ñoño" });
  const emoji = await insertOrder({ name: "🎁 Ramo" });
  const longName = "á".repeat(200);
  const long = await insertOrder({ name: longName });
  const coded = await insertOrder({ name: "Código" });
  const token = await loginToken();

  async function codesFor(q: string): Promise<string[]> {
    const response = await adminFetch(`/admin/orders?q=${encodeURIComponent(q)}`, { token });
    expect(response.status).toBe(200);
    const items = record(await response.json()).items;
    if (!Array.isArray(items)) throw new Error("expected items");
    return items.map((row) => {
      const code = record(row).code;
      if (typeof code !== "string") throw new Error("expected code");
      return code;
    });
  }

  expect(await codesFor("100%")).toEqual([percent.code]);
  expect(await codesFor("a_b")).toEqual([underscore.code]);
  expect(await codesFor(`Ana "O'Hara"`)).toEqual([quoted.code]);
  expect(await codesFor("María")).toEqual([accented.code]);
  expect(await codesFor("🎁")).toEqual([emoji.code]);
  expect(await codesFor("")).toHaveLength(9);
  expect(await codesFor(longName)).toEqual([long.code]);
  expect(await codesFor(coded.code.toLowerCase())).toEqual([]);
  expect(await codesFor(`${coded.code} `)).toEqual([]);
  expect(await codesFor(coded.code)).toEqual([coded.code]);
});

it("GET /admin/orders/:code returns the admin order and its items from one read", async () => {
  await insertProduct({ id: "taza", name: "Taza" });
  const order = await insertOrder({
    name: "Lucía",
    phone: "900111222",
    email: "secreto@example.com",
    note: "tocar el timbre",
    items: [
      { productId: "taza", name: "Taza", qty: 2, unit: 1500 },
      { productId: "taza", name: "Mix de flores", qty: 1, unit: 3000 },
    ],
  });
  const logs = watchLogs();
  try {
    const token = await loginToken();
    const response = await adminFetch(`/admin/orders/${order.code}`, { token });
    expect(response.status).toBe(200);
    const body = record(await response.json());
    expect(body.customer).toEqual({
      name: "Lucía",
      phone: "900111222",
      email: "secreto@example.com",
    });
    expect(body.note).toBe("tocar el timbre");
    expect(body.itemsShort).toBeUndefined();
    const items = body.items;
    if (!Array.isArray(items)) throw new Error("expected items");
    expect(items).toHaveLength(2);
    expect(record(items[0]).lineTotalCents).toBe(3000);
    expect(logs.text()).not.toContain(token);
    expect(logs.text()).not.toContain("900111222");
    expect(logs.text()).not.toContain("secreto@example.com");
  } finally {
    logs.restore();
  }
});

it("GET /admin/orders/:code misses unknown and lowercase codes", async () => {
  const order = await insertOrder();
  const token = await loginToken();
  for (const code of ["REG-2026-9999", "nope", order.code.toLowerCase()]) {
    const response = await adminFetch(`/admin/orders/${encodeURIComponent(code)}`, { token });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(NOT_FOUND);
  }
});

it("GET /admin/orders/:code/capture streams the stored bytes and content type", async () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const key = "captures/pago.jpg";
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });
  const order = await insertOrder({ captureKey: key });
  const token = await loginToken();
  const response = await adminFetch(`/admin/orders/${order.code}/capture`, { token });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
});

it("GET /admin/orders/:code/capture is 404 without an order or a file", async () => {
  const token = await loginToken();
  const missing = await adminFetch("/admin/orders/REG-2026-9999/capture", { token });
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual(NOT_FOUND);
  const order = await insertOrder({ captureKey: "captures/missing.jpg" });
  const gone = await adminFetch(`/admin/orders/${order.code}/capture`, { token });
  expect(gone.status).toBe(404);
  expect(await gone.json()).toEqual(NOT_FOUND);
  const bare = await env.FILES.put("captures/bare.bin", Uint8Array.from([1, 2, 3]));
  void bare;
  const plain = await insertOrder({ captureKey: "captures/bare.bin" });
  const response = await adminFetch(`/admin/orders/${plain.code}/capture`, { token });
  expect(response.headers.get("content-type")).toBe("application/octet-stream");
});

it("POST /admin/orders/:code/status without a header is 401", async () => {
  const response = await adminFetch("/admin/orders/REG-2026-0001/status", {
    method: "POST",
    json: { to: "confirmado" },
  });
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("POST /admin/orders/:code/status validates the body and misses unknown orders", async () => {
  const token = await loginToken();
  const invalid = await adminFetch("/admin/orders/REG-2026-0001/status", {
    method: "POST",
    token,
    json: { to: "nope" },
  });
  expect(invalid.status).toBe(422);
  expect(record(record(await invalid.json()).error).code).toBe("validation_error");
  const missing = await adminFetch("/admin/orders/REG-2026-9999/status", {
    method: "POST",
    token,
    json: { to: "confirmado" },
  });
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual(NOT_FOUND);
});

it.each(transitions)("$from → $to", async ({ from, to, ok }) => {
  const today = limaToday(new Date());
  const stamp = `${today}T08:00:00.000-05:00`;
  const order = await insertOrder({
    status: from,
    verifiedAt: from === "por_verificar" || from === "rechazado" ? null : stamp,
    deliveredAt: from === "entregado" ? stamp : null,
    rejectedAt: from === "rechazado" ? stamp : null,
  });
  const response = await adminFetch(`/admin/orders/${order.code}/status`, {
    method: "POST",
    token: await loginToken(),
    json: { to },
  });
  if (ok) {
    expect(response.status).toBe(200);
    expect(record(await response.json()).status).toBe(to);
  } else {
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(INVALID);
    expect(await statusOf(order.code)).toBe(from);
  }
});

it("confirmado sets verifiedAt and does not change stock", async () => {
  await insertProduct({ id: "p1", stock: 5 });
  const order = await insertOrder({
    items: [{ productId: "p1", name: "Taza", qty: 2 }],
  });
  const response = await adminFetch(`/admin/orders/${order.code}/status`, {
    method: "POST",
    token: await loginToken(),
    json: { to: "confirmado" },
  });
  expect(response.status).toBe(200);
  const body = record(await response.json());
  expect(body.status).toBe("confirmado");
  expect(body.verifiedAt).toMatch(
    new RegExp(`^${limaToday(new Date())}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}-05:00$`),
  );
  expect(body).not.toHaveProperty("rejectedAt");
  expect(await stockOf("p1")).toBe(5);
});

it("entregado sets deliveredAt and keeps verifiedAt", async () => {
  const verifiedAt = `${limaToday(new Date())}T08:00:00.000-05:00`;
  const order = await insertOrder({ status: "listo", verifiedAt });
  const response = await adminFetch(`/admin/orders/${order.code}/status`, {
    method: "POST",
    token: await loginToken(),
    json: { to: "entregado" },
  });
  const body = record(await response.json());
  expect(body.verifiedAt).toBe(verifiedAt);
  expect(body.deliveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-05:00$/);
});

it("rechazado restores the stock of every item once", async () => {
  await insertProduct({ id: "p1", stock: 1 });
  await insertProduct({ id: "p2", stock: 4 });
  const order = await insertOrder({
    items: [
      { productId: "p1", name: "Taza", qty: 2 },
      { productId: "p1", name: "Taza", qty: 3 },
      { productId: "p2", name: "Mix", qty: 1 },
    ],
  });
  const response = await adminFetch(`/admin/orders/${order.code}/status`, {
    method: "POST",
    token: await loginToken(),
    json: { to: "rechazado" },
  });
  expect(response.status).toBe(200);
  const body = record(await response.json());
  expect(body.status).toBe("rechazado");
  expect(body).not.toHaveProperty("verifiedAt");
  expect(await stockOf("p1")).toBe(6);
  expect(await stockOf("p2")).toBe(5);
  const again = await adminFetch(`/admin/orders/${order.code}/status`, {
    method: "POST",
    token: await loginToken(),
    json: { to: "rechazado" },
  });
  expect(again.status).toBe(409);
  expect(await stockOf("p1")).toBe(6);
  expect(await stockOf("p2")).toBe(5);
});

it("two rejects that both saw por_verificar restore stock once", async () => {
  await insertProduct({ id: "p1", stock: 5 });
  const order = await insertOrder({ items: [{ productId: "p1", name: "Taza", qty: 2 }] });
  const today = limaToday(new Date());
  const [first, second] = await Promise.all([
    commitStatus(env.DB, order.id, "por_verificar", "rechazado", `${today}T01:00:00.000-05:00`),
    commitStatus(env.DB, order.id, "por_verificar", "rechazado", `${today}T01:00:00.001-05:00`),
  ]);
  expect([first, second].filter(Boolean)).toHaveLength(1);
  expect(await stockOf("p1")).toBe(7);
});

it("a reject and a confirm that both saw por_verificar let only one win", async () => {
  await insertProduct({ id: "p1", stock: 5 });
  const order = await insertOrder({ items: [{ productId: "p1", name: "Taza", qty: 2 }] });
  const today = limaToday(new Date());
  const [rejected, confirmed] = await Promise.all([
    commitStatus(env.DB, order.id, "por_verificar", "rechazado", `${today}T01:00:00.000-05:00`),
    commitStatus(env.DB, order.id, "por_verificar", "confirmado", `${today}T02:00:00.000-05:00`),
  ]);
  expect([rejected, confirmed].filter(Boolean)).toHaveLength(1);
  expect(await stockOf("p1")).toBe(rejected ? 7 : 5);
  expect(await statusOf(order.code)).toBe(rejected ? "rechazado" : "confirmado");
});
