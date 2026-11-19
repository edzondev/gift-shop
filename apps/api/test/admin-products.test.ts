import { env } from "cloudflare:workers";
import { afterEach, beforeEach, expect, it } from "vitest";
import app from "../src/index";
import { accessPairs, bindings, goodToken, installJwks, restoreAccessFetch } from "./access";

const UNAUTHORIZED = { error: { code: "unauthorized", message: "Unauthorized" } };
const FORBIDDEN = { error: { code: "forbidden", message: "Forbidden" } };
const NOT_FOUND = { error: { code: "product_not_found", message: "Product not found" } };
const PHOTO_NOT_FOUND = { error: { code: "photo_not_found", message: "Photo not found" } };
const SLUG_TAKEN = { error: { code: "slug_taken", message: "Slug is already taken" } };
const TOO_MANY = {
  error: { code: "too_many_photos", message: "A product can have at most 3 photos" },
};
const FILE_TOO_LARGE = { error: { code: "file_too_large", message: "File is too large" } };
const UNSUPPORTED = {
  error: { code: "unsupported_file_type", message: "Unsupported file type" },
};
const VALIDATION = { error: { code: "validation_error", message: "Validation failed" } };

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

const ROUTES: readonly (readonly [string, string])[] = [
  ["GET", "/admin/products"],
  ["GET", "/admin/products/p01"],
  ["POST", "/admin/products"],
  ["PATCH", "/admin/products/p01"],
  ["POST", "/admin/products/p01/stock"],
  ["POST", "/admin/products/p01/photos"],
  ["DELETE", "/admin/products/p01/photos/ph01"],
];

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

function textField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string") throw new Error(`expected ${key}`);
  return value;
}

function numberField(body: Record<string, unknown>, key: string): number {
  const value = body[key];
  if (typeof value !== "number") throw new Error(`expected ${key}`);
  return value;
}

function productInput(overrides: Record<string, unknown> = {}) {
  return {
    slug: "ramo-nube",
    name: "  Ramo nube  ",
    priceCents: 4500,
    oldPriceCents: 8900,
    prepDays: 2,
    description: "  Flores de estación  ",
    fields: ["nombre", "tarjeta"],
    occasions: ["mama", "cumple"],
    tag: "  Nuevo  ",
    sizes: { classic: " Clásica ", large: " Grande ", largeExtraCents: 1500 },
    active: true,
    initialStock: 2,
    ...overrides,
  };
}

function fileFrom(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes], name, { type });
}

function photoForm(bytes: Uint8Array, name: string, type: string): FormData {
  const form = new FormData();
  form.set("photo", fileFrom(bytes, name, type));
  return form;
}

async function authed(
  path: string,
  options: { method?: string; json?: unknown; form?: FormData } = {},
) {
  const headers = new Headers();
  headers.set("Cf-Access-Jwt-Assertion", await goodToken());
  const method = options.method ?? "GET";
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
    return app.request(path, { method, headers, body: JSON.stringify(options.json) }, bindings());
  }
  if (options.form !== undefined) {
    return app.request(path, { method, headers, body: options.form }, bindings());
  }
  return app.request(path, { method, headers }, bindings());
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
  slug?: string;
  stock?: number;
  active?: number;
  name?: string;
}): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO products (
      id, slug, name, price_cents, old_price_cents, stock, prep_days, description,
      fields, occasions, tag, size_classic, size_large, large_extra_cents, active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.id,
      input.slug ?? input.id,
      input.name ?? "Ramo",
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

async function seedPhoto(productId: string, position: number): Promise<string> {
  const id = crypto.randomUUID();
  const key = `photos/${id}.jpg`;
  await env.FILES.put(key, JPEG);
  await env.DB.prepare(
    "INSERT INTO product_photos (id, product_id, r2_key, position) VALUES (?, ?, ?, ?)",
  )
    .bind(id, productId, key, position)
    .run();
  return key;
}

async function stockOf(id: string): Promise<number> {
  const raw = await env.DB.prepare("SELECT stock FROM products WHERE id = ?").bind(id).first();
  return numberField(record(raw), "stock");
}

async function positionsOf(productId: string): Promise<number[]> {
  const result = await env.DB.prepare(
    "SELECT position FROM product_photos WHERE product_id = ? ORDER BY position",
  )
    .bind(productId)
    .all();
  return result.results.map((raw) => numberField(record(raw), "position"));
}

async function objectKeys(): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = cursor === undefined ? await env.FILES.list() : await env.FILES.list({ cursor });
    for (const object of listed.objects) keys.push(object.key);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined);
  return keys.sort();
}

async function storedKeys(): Promise<string[]> {
  const result = await env.DB.prepare("SELECT r2_key FROM product_photos ORDER BY r2_key").all();
  return result.results.map((raw) => textField(record(raw), "r2_key")).sort();
}

function photoFromKey(key: string): { id: string; key: string } {
  return { id: key.slice("photos/".length, -".jpg".length), key };
}

function slugs(body: Record<string, unknown>): string[] {
  return entries(body.items).map((item) => textField(record(item), "slug"));
}

function issuePaths(value: unknown): string[] {
  const details = record(record(record(value).error).details);
  return entries(details.issues).map((issue) => textField(record(issue), "path"));
}

function codes(responses: readonly Response[]): number[] {
  return responses.map((response) => response.status).sort((left, right) => left - right);
}

function productsPath(params: Record<string, string> = {}): string {
  const search = new URLSearchParams(params).toString();
  return search === "" ? "/admin/products" : `/admin/products?${search}`;
}

beforeEach(async () => {
  await reset();
  const [good] = await accessPairs;
  if (good === undefined) throw new Error("missing key");
  installJwks(good.publicKey);
});

afterEach(() => {
  restoreAccessFetch();
});

it.each(ROUTES)("%s %s without a jwt is 401", async (method, path) => {
  const response = await app.request(path, { method }, bindings());
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual(UNAUTHORIZED);
});

it("creates a product, trims text, and returns the admin shape", async () => {
  const response = await authed("/admin/products", { method: "POST", json: productInput() });
  expect(response.status).toBe(201);
  const body = record(await response.json());
  expect(textField(body, "id")).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  expect(body).toMatchObject({
    slug: "ramo-nube",
    name: "Ramo nube",
    priceCents: 4500,
    oldPriceCents: 8900,
    tag: "Nuevo",
    occasions: ["mama", "cumple"],
    prepDays: 2,
    photoKeys: [],
    customizable: true,
    stockLeft: 2,
    description: "Flores de estación",
    fields: ["nombre", "tarjeta"],
    sizes: { classic: "Clásica", large: "Grande", largeExtraCents: 1500 },
    inStock: true,
    stock: 2,
    active: true,
    photos: [],
  });
});

it("defaults initialStock to 0", async () => {
  const { initialStock, ...input } = productInput({ slug: "sin-stock" });
  void initialStock;
  const response = await authed("/admin/products", { method: "POST", json: input });
  expect(response.status).toBe(201);
  const body = record(await response.json());
  expect(body.stock).toBe(0);
  expect(body.inStock).toBe(false);
  expect(body.stockLeft).toBe(0);
});

it("rejects a repeated slug with 409 slug_taken", async () => {
  const first = await authed("/admin/products", { method: "POST", json: productInput() });
  expect(first.status).toBe(201);
  const second = await authed("/admin/products", {
    method: "POST",
    json: productInput({ name: "Otro" }),
  });
  expect(second.status).toBe(409);
  expect(await second.json()).toEqual(SLUG_TAKEN);
});

it("one of two concurrent creates with the same slug wins", async () => {
  const input = productInput({ slug: "ramo-unico" });
  const responses = await Promise.all([
    authed("/admin/products", { method: "POST", json: input }),
    authed("/admin/products", { method: "POST", json: input }),
  ]);
  expect(codes(responses)).toEqual([201, 409]);
  const conflict = responses.find((response) => response.status === 409);
  expect(await conflict?.json()).toEqual(SLUG_TAKEN);
  const count = record(await env.DB.prepare("SELECT COUNT(*) AS n FROM products").first());
  expect(count.n).toBe(1);
});

it.each(["Ramo", "ramo rojo", "ramo--rojo", "ramo-", "Ramo-Rojo"])(
  "rejects slug %s",
  async (slug) => {
    const response = await authed("/admin/products", {
      method: "POST",
      json: productInput({ slug }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toMatchObject(VALIDATION);
    expect(issuePaths(body)).toContain("slug");
  },
);

it("accepts accents, emoji, newlines, and 2000 characters in name and description", async () => {
  const prefix = "Ñandú 🌸\n";
  const text = `${prefix}${"a".repeat(2000 - prefix.length)}`;
  expect(text).toHaveLength(2000);
  const response = await authed("/admin/products", {
    method: "POST",
    json: productInput({ slug: "texto-largo", name: text, description: text }),
  });
  expect(response.status).toBe(201);
  const body = record(await response.json());
  expect(body.name).toBe(text);
  expect(body.description).toBe(text);
});

it("rejects a name or description that is only whitespace", async () => {
  const response = await authed("/admin/products", {
    method: "POST",
    json: productInput({ name: "   ", description: " \n\t " }),
  });
  expect(response.status).toBe(422);
  const body = await response.json();
  expect(body).toMatchObject(VALIDATION);
  expect(issuePaths(body)).toEqual(expect.arrayContaining(["name", "description"]));
});

it("rejects a non-positive price and a prepDays outside 0 to 30", async () => {
  const response = await authed("/admin/products", {
    method: "POST",
    json: productInput({ priceCents: 0, prepDays: 31, oldPriceCents: -1 }),
  });
  expect(response.status).toBe(422);
  expect(issuePaths(await response.json())).toEqual(
    expect.arrayContaining(["priceCents", "prepDays", "oldPriceCents"]),
  );
});

it("lists a hidden product in admin and leaves it out of the public catalog", async () => {
  const created = await authed("/admin/products", {
    method: "POST",
    json: productInput({ slug: "ramo-oculto", active: false }),
  });
  expect(created.status).toBe(201);
  const admin = record(await (await authed("/admin/products")).json());
  expect(slugs(admin)).toContain("ramo-oculto");
  expect(record(entries(admin.items)[0]).active).toBe(false);

  const listed = await app.request("/products", {}, { DB: env.DB });
  expect(listed.status).toBe(200);
  expect(slugs(record(await listed.json()))).not.toContain("ramo-oculto");
  const detail = await app.request("/products/ramo-oculto", {}, { DB: env.DB });
  expect(detail.status).toBe(404);
});

it("pages with an opaque cursor and includes a hidden product on the next page", async () => {
  await insertProduct({ id: "p01", slug: "uno" });
  await insertProduct({ id: "p02", slug: "dos" });
  await insertProduct({ id: "p03", slug: "tres", active: 0 });

  const first = await authed(productsPath({ limit: "2" }));
  expect(first.status).toBe(200);
  const page = record(await first.json());
  expect(slugs(page)).toEqual(["uno", "dos"]);
  const cursor = textField(page, "nextCursor");
  expect(cursor).not.toBe("p02");

  const second = await authed(productsPath({ cursor }));
  expect(second.status).toBe(200);
  const rest = record(await second.json());
  expect(slugs(rest)).toEqual(["tres"]);
  expect(record(entries(rest.items)[0]).active).toBe(false);
  expect(rest.nextCursor).toBeNull();
});

it("rejects an invalid products cursor", async () => {
  const response = await authed(productsPath({ cursor: "not-a-cursor" }));
  expect(response.status).toBe(422);
  expect(issuePaths(await response.json())).toContain("cursor");
});

it("rejects limit outside 1 to 50", async () => {
  const response = await authed(productsPath({ limit: "51" }));
  expect(response.status).toBe(422);
  expect(issuePaths(await response.json())).toContain("limit");
});

it("patches only the sent columns", async () => {
  const created = record(
    await (await authed("/admin/products", { method: "POST", json: productInput() })).json(),
  );
  const id = textField(created, "id");
  const response = await authed(`/admin/products/${id}`, {
    method: "PATCH",
    json: { name: "  Ramo editado  " },
  });
  expect(response.status).toBe(200);
  const body = record(await response.json());
  expect(body.name).toBe("Ramo editado");
  expect(body.slug).toBe("ramo-nube");
  expect(body.priceCents).toBe(4500);
  expect(body.stock).toBe(2);
  expect(body.description).toBe("Flores de estación");
});

it("rejects an empty product patch", async () => {
  await insertProduct({ id: "p01" });
  const response = await authed("/admin/products/p01", { method: "PATCH", json: {} });
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject(VALIDATION);
  expect(await stockOf("p01")).toBe(8);
});

it("rejects initialStock on patch and leaves the stock unchanged", async () => {
  await insertProduct({ id: "p01", stock: 4 });
  const response = await authed("/admin/products/p01", {
    method: "PATCH",
    json: { initialStock: 9 },
  });
  expect(response.status).toBe(422);
  expect(await stockOf("p01")).toBe(4);
});

it("returns 404 when patching a missing product", async () => {
  const response = await authed("/admin/products/missing", {
    method: "PATCH",
    json: { name: "Nada" },
  });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual(NOT_FOUND);
});

it("returns 409 when a patch takes a slug that already exists", async () => {
  await insertProduct({ id: "p01", slug: "uno" });
  await insertProduct({ id: "p02", slug: "dos" });
  const response = await authed("/admin/products/p02", {
    method: "PATCH",
    json: { slug: "uno" },
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual(SLUG_TAKEN);
});

it("sets stock to zero with a delta and then adds five", async () => {
  await insertProduct({ id: "p01", stock: 2 });
  const emptied = await authed("/admin/products/p01/stock", {
    method: "POST",
    json: { delta: -2 },
  });
  expect(emptied.status).toBe(200);
  const emptyBody = record(await emptied.json());
  expect(emptyBody.stock).toBe(0);
  expect(emptyBody.inStock).toBe(false);
  expect(emptyBody.stockLeft).toBe(0);

  const filled = await authed("/admin/products/p01/stock", {
    method: "POST",
    json: { delta: 5 },
  });
  expect(filled.status).toBe(200);
  const filledBody = record(await filled.json());
  expect(filledBody.stock).toBe(5);
  expect(filledBody.inStock).toBe(true);
  expect(filledBody.stockLeft).toBeNull();
  expect(await stockOf("p01")).toBe(5);
});

it("one of two concurrent deltas of -1 wins when stock is 1", async () => {
  await insertProduct({ id: "p01", stock: 1 });
  const responses = await Promise.all([
    authed("/admin/products/p01/stock", { method: "POST", json: { delta: -1 } }),
    authed("/admin/products/p01/stock", { method: "POST", json: { delta: -1 } }),
  ]);
  expect(codes(responses)).toEqual([200, 409]);
  const conflict = responses.find((response) => response.status === 409);
  expect(record(record(await conflict?.json()).error).code).toBe("out_of_stock");
  expect(await stockOf("p01")).toBe(0);
});

it("rejects a delta that would make stock negative and leaves the stock", async () => {
  await insertProduct({ id: "p01", stock: 0 });
  const response = await authed("/admin/products/p01/stock", {
    method: "POST",
    json: { delta: -1 },
  });
  expect(response.status).toBe(409);
  expect(record(record(await response.json()).error).code).toBe("out_of_stock");
  expect(await stockOf("p01")).toBe(0);
});

it.each([0, 1.5, 1000, -1000])("rejects stock delta %s", async (delta) => {
  await insertProduct({ id: "p01", stock: 3 });
  const response = await authed("/admin/products/p01/stock", {
    method: "POST",
    json: { delta },
  });
  expect(response.status).toBe(422);
  expect(issuePaths(await response.json())).toContain("delta");
  expect(await stockOf("p01")).toBe(3);
});

it("returns 404 when adjusting stock of a missing product", async () => {
  const response = await authed("/admin/products/missing/stock", {
    method: "POST",
    json: { delta: 1 },
  });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual(NOT_FOUND);
});

it.each([
  ["jpeg", JPEG, "image/jpeg", "jpg"],
  ["png", PNG, "image/png", "png"],
  ["webp", WEBP, "image/webp", "webp"],
])(
  "stores a %s photo from its bytes when Content-Type is wrong",
  async (_label, bytes, _type, extension) => {
    await insertProduct({ id: "p01" });
    const response = await authed("/admin/products/p01/photos", {
      method: "POST",
      form: photoForm(bytes, "foto.txt", "application/pdf"),
    });
    expect(response.status).toBe(201);
    const body = record(await response.json());
    const key = textField(body, "key");
    expect(key).toBe(`photos/${textField(body, "id")}.${extension}`);
    expect(await objectKeys()).toEqual([key]);
    const listed = record(await (await authed("/admin/products")).json());
    const product = record(entries(listed.items)[0]);
    expect(product.photoKeys).toEqual([key]);
    expect(product.photos).toEqual([{ id: textField(body, "id"), key }]);
  },
);

it("rejects a jpg whose bytes are a pdf", async () => {
  await insertProduct({ id: "p01" });
  const response = await authed("/admin/products/p01/photos", {
    method: "POST",
    form: photoForm(PDF, "foto.jpg", "image/jpeg"),
  });
  expect(response.status).toBe(415);
  expect(await response.json()).toEqual(UNSUPPORTED);
  expect(await objectKeys()).toEqual([]);
  expect(await storedKeys()).toEqual([]);
});

it("rejects a photo over 5 MB", async () => {
  await insertProduct({ id: "p01" });
  const bytes = new Uint8Array(5 * 1024 * 1024 + 1);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  const response = await authed("/admin/products/p01/photos", {
    method: "POST",
    form: photoForm(bytes, "foto.jpg", "image/jpeg"),
  });
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual(FILE_TOO_LARGE);
  expect(await objectKeys()).toEqual([]);
}, 20000);

it("accepts a photo of exactly 5 MB", async () => {
  await insertProduct({ id: "p01" });
  const bytes = new Uint8Array(5 * 1024 * 1024);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  const response = await authed("/admin/products/p01/photos", {
    method: "POST",
    form: photoForm(bytes, "foto.jpg", "text/plain"),
  });
  expect(response.status).toBe(201);
  expect(await storedKeys()).toEqual(await objectKeys());
}, 20000);

it("rejects a photo body over 6 MB", async () => {
  const form = new FormData();
  form.set("photo", "x".repeat(6 * 1024 * 1024 + 1));
  const response = await authed("/admin/products/p01/photos", { method: "POST", form });
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual(FILE_TOO_LARGE);
}, 20000);

it("returns 404 when uploading a photo for a missing product and stores nothing", async () => {
  const response = await authed("/admin/products/missing/photos", {
    method: "POST",
    form: photoForm(JPEG, "foto.jpg", "image/jpeg"),
  });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual(NOT_FOUND);
  expect(await objectKeys()).toEqual([]);
});

it("rejects a fourth photo and leaves no orphan in R2", async () => {
  await insertProduct({ id: "p01" });
  const before = [await seedPhoto("p01", 1), await seedPhoto("p01", 2), await seedPhoto("p01", 3)];
  const response = await authed("/admin/products/p01/photos", {
    method: "POST",
    form: photoForm(JPEG, "foto.jpg", "image/jpeg"),
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual(TOO_MANY);
  expect(await storedKeys()).toEqual([...before].sort());
  expect(await objectKeys()).toEqual([...before].sort());
});

it("one of two concurrent photos wins when two are already stored, without an orphan", async () => {
  await insertProduct({ id: "p01" });
  const before = [await seedPhoto("p01", 1), await seedPhoto("p01", 2)];
  const responses = await Promise.all([
    authed("/admin/products/p01/photos", {
      method: "POST",
      form: photoForm(JPEG, "a.jpg", "image/jpeg"),
    }),
    authed("/admin/products/p01/photos", {
      method: "POST",
      form: photoForm(PNG, "b.png", "image/png"),
    }),
  ]);
  expect(codes(responses)).toEqual([201, 409]);
  const conflict = responses.find((response) => response.status === 409);
  expect(await conflict?.json()).toEqual(TOO_MANY);
  const keys = await storedKeys();
  expect(keys).toHaveLength(3);
  expect(keys).toEqual(expect.arrayContaining(before));
  expect(await objectKeys()).toEqual(keys);
});

it("reuses the freed position when a photo is deleted and uploaded again", async () => {
  await insertProduct({ id: "p01" });
  const first = await seedPhoto("p01", 1);
  const middleId = crypto.randomUUID();
  const middle = `photos/${middleId}.jpg`;
  await env.FILES.put(middle, JPEG);
  await env.DB.prepare(
    "INSERT INTO product_photos (id, product_id, r2_key, position) VALUES (?, ?, ?, ?)",
  )
    .bind(middleId, "p01", middle, 2)
    .run();
  await seedPhoto("p01", 3);

  const removed = await authed(`/admin/products/p01/photos/${middleId}`, { method: "DELETE" });
  expect(removed.status).toBe(204);
  expect(await removed.text()).toBe("");
  expect(await env.FILES.get(middle)).toBeNull();
  expect(await positionsOf("p01")).toEqual([1, 3]);

  const uploaded = await authed("/admin/products/p01/photos", {
    method: "POST",
    form: photoForm(JPEG, "nuevo.jpg", "image/jpeg"),
  });
  expect(uploaded.status).toBe(201);
  expect(await positionsOf("p01")).toEqual([1, 2, 3]);
  const position = record(
    await env.DB.prepare("SELECT position FROM product_photos WHERE r2_key = ?")
      .bind(textField(record(await uploaded.json()), "key"))
      .first(),
  );
  expect(position.position).toBe(2);
  expect(await storedKeys()).toContain(first);
});

it("returns 404 when deleting a photo that is not on that product", async () => {
  await insertProduct({ id: "p01" });
  await insertProduct({ id: "p02" });
  const key = await seedPhoto("p01", 1);
  const id = key.slice("photos/".length, -".jpg".length);
  const missing = await authed("/admin/products/p01/photos/nope", { method: "DELETE" });
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual(PHOTO_NOT_FOUND);
  const other = await authed(`/admin/products/p02/photos/${id}`, { method: "DELETE" });
  expect(other.status).toBe(404);
  expect(await other.json()).toEqual(PHOTO_NOT_FOUND);
  expect(await env.FILES.get(key)).not.toBeNull();
});

it("loads every photo on the page in the listed order", async () => {
  await insertProduct({ id: "p01", slug: "uno" });
  await insertProduct({ id: "p02", slug: "dos" });
  const second = await seedPhoto("p01", 2);
  const first = await seedPhoto("p01", 1);
  const only = await seedPhoto("p02", 1);
  const response = await authed("/admin/products");
  expect(response.status).toBe(200);
  const items = entries(record(await response.json()).items);
  const left = record(items[0]);
  const right = record(items[1]);
  expect(left.photoKeys).toEqual([first, second]);
  expect(entries(left.photos).map((photo) => textField(record(photo), "key"))).toEqual([
    first,
    second,
  ]);
  expect(right.photoKeys).toEqual([only]);
});

it("returns a visible product", async () => {
  await insertProduct({ id: "p01", slug: "ramo-nube", name: "Ramo nube", stock: 8, active: 1 });
  const response = await authed("/admin/products/p01");
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toEqual({
    id: "p01",
    slug: "ramo-nube",
    name: "Ramo nube",
    priceCents: 4500,
    oldPriceCents: null,
    tag: null,
    occasions: [],
    prepDays: 2,
    photoKeys: [],
    customizable: false,
    stockLeft: null,
    description: "Flores",
    fields: [],
    sizes: { classic: "Clásica", large: "Grande", largeExtraCents: 1500 },
    inStock: true,
    stock: 8,
    active: true,
    photos: [],
  });
});

it("returns a hidden product with active false", async () => {
  await insertProduct({ id: "p-oculto", slug: "oculto", active: 0, stock: 0 });
  const response = await authed("/admin/products/p-oculto");
  expect(response.status).toBe(200);
  const body = record(await response.json());
  expect(body.id).toBe("p-oculto");
  expect(body.active).toBe(false);
  expect(body.inStock).toBe(false);
  expect(body.stock).toBe(0);
  expect(body.photos).toEqual([]);
});

it("returns zero, one, and three photos in position order", async () => {
  await insertProduct({ id: "none", slug: "none" });
  await insertProduct({ id: "one", slug: "one" });
  await insertProduct({ id: "three", slug: "three" });
  const only = await seedPhoto("one", 1);
  const third = await seedPhoto("three", 3);
  const first = await seedPhoto("three", 1);
  const second = await seedPhoto("three", 2);

  const empty = await authed("/admin/products/none");
  expect(empty.status).toBe(200);
  expect(record(await empty.json()).photos).toEqual([]);

  const single = await authed("/admin/products/one");
  expect(single.status).toBe(200);
  expect(record(await single.json()).photos).toEqual([photoFromKey(only)]);

  const full = await authed("/admin/products/three");
  expect(full.status).toBe(200);
  expect(record(await full.json()).photos).toEqual([
    photoFromKey(first),
    photoFromKey(second),
    photoFromKey(third),
  ]);
});

it("returns 404 when the product does not exist", async () => {
  const response = await authed("/admin/products/missing");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual(NOT_FOUND);
});

it("returns 403 when the jwt email is not the admin", async () => {
  await insertProduct({ id: "p01" });
  const headers = new Headers();
  headers.set("Cf-Access-Jwt-Assertion", await goodToken({ email: "otra@example.com" }));
  const response = await app.request("/admin/products/p01", { method: "GET", headers }, bindings());
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual(FORBIDDEN);
});

it.each(["P01", "ñoño", "a'b", "a b", "a/b", "%", "a\u0000b", "x".repeat(2048)])(
  "returns 404 for product id %s",
  async (id) => {
    await insertProduct({ id: "p01" });
    const response = await authed(`/admin/products/${encodeURIComponent(id)}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(NOT_FOUND);
  },
);

it("an empty product id does not match the route", async () => {
  const response = await authed("/admin/products/");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: { code: "not_found", message: "Not Found" } });
});
