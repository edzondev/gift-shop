import { env } from "cloudflare:workers";
import { beforeEach, expect, it } from "vitest";
import app from "../src/index";

const IMAGE_NOT_FOUND = { error: { code: "image_not_found", message: "Image not found" } };
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

const KEY = "photos/caja.webp";

function imagePath(key: string): string {
  return `/images/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

async function reset(): Promise<void> {
  await env.DB.prepare("DELETE FROM product_photos").run();
  await env.DB.prepare("DELETE FROM products").run();
  let cursor: string | undefined;
  do {
    const listed = cursor === undefined ? await env.FILES.list() : await env.FILES.list({ cursor });
    const keys = listed.objects
      .map((object) => object.key)
      .filter((key) => key === "captures/not-a-photo.jpg" || !key.startsWith("captures/"));
    await Promise.all(keys.map((key) => env.FILES.delete(key)));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined);
}

async function insertPhoto(key: string, active = 1): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO products (
      id, slug, name, price_cents, old_price_cents, stock, prep_days, description,
      fields, occasions, tag, size_classic, size_large, large_extra_cents, active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      "p-img",
      "p-img",
      "Ramo",
      4500,
      null,
      8,
      2,
      "Flores de estación",
      "[]",
      "[]",
      null,
      "Clásica",
      "Grande",
      1500,
      active,
      "2026-11-18T12:00:00-05:00",
    )
    .run();
  await env.DB.prepare(
    "INSERT INTO product_photos (id, product_id, r2_key, position) VALUES (?, ?, ?, ?)",
  )
    .bind("ph-img", "p-img", key, 0)
    .run();
}

async function putPhoto(key: string): Promise<void> {
  await env.FILES.put(key, JPEG, { httpMetadata: { contentType: "image/jpeg" } });
}

function getImage(path: string, headers?: HeadersInit) {
  return app.request(path, headers === undefined ? {} : { headers }, env);
}

async function expectImage(path: string): Promise<Response> {
  const response = await getImage(path);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL);
  expect(response.headers.get("etag")).toEqual(expect.any(String));
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
  return response;
}

async function expectMissing(path: string): Promise<void> {
  const response = await getImage(path);
  expect(response.status).toBe(404);
  expect(response.headers.get("etag")).toBeNull();
  expect(response.headers.get("cache-control")).not.toBe(CACHE_CONTROL);
  expect(await response.json()).toEqual(IMAGE_NOT_FOUND);
}

beforeEach(async () => {
  await reset();
});

it("serves a product photo from R2 without buffering the bytes away", async () => {
  await insertPhoto(KEY);
  await putPhoto(KEY);

  const response = await getImage(imagePath(KEY));
  expect(response.status).toBe(200);
  expect(response.body).not.toBeNull();
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL);
  const stored = await env.FILES.get(KEY);
  expect(response.headers.get("etag")).toBe(stored?.httpEtag ?? null);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
});

it("HEAD returns the same headers and an empty body", async () => {
  await insertPhoto(KEY);
  await putPhoto(KEY);

  const response = await app.request(imagePath(KEY), { method: "HEAD" }, env);
  expect(response.status).toBe(200);
  expect(response.body).toBeNull();
  expect(await response.text()).toBe("");
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL);
  const stored = await env.FILES.get(KEY);
  expect(response.headers.get("etag")).toBe(stored?.httpEtag ?? null);
});

it("returns 304 without a body when If-None-Match equals the ETag", async () => {
  await insertPhoto(KEY);
  await putPhoto(KEY);

  const first = await getImage(imagePath(KEY));
  const etag = first.headers.get("etag");
  expect(etag).toEqual(expect.any(String));
  await first.arrayBuffer();

  const response = await getImage(imagePath(KEY), { "If-None-Match": etag ?? "" });
  expect(response.status).toBe(304);
  expect(response.body).toBeNull();
  expect(await response.text()).toBe("");
  expect(response.headers.get("etag")).toBe(etag);
  expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL);
});

it("returns 200 when If-None-Match is a different ETag", async () => {
  await insertPhoto(KEY);
  await putPhoto(KEY);

  const response = await getImage(imagePath(KEY), { "If-None-Match": '"different"' });
  expect(response.status).toBe(200);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
});

it("serves two concurrent reads of the same key", async () => {
  await insertPhoto(KEY);
  await putPhoto(KEY);

  const [first, second] = await Promise.all([getImage(imagePath(KEY)), getImage(imagePath(KEY))]);
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(new Uint8Array(await first.arrayBuffer())).toEqual(JPEG);
  expect(new Uint8Array(await second.arrayBuffer())).toEqual(JPEG);
});

it("returns image_not_found when the row remains but the R2 object was deleted", async () => {
  await insertPhoto(KEY);
  await putPhoto(KEY);
  await env.FILES.delete(KEY);

  await expectMissing(imagePath(KEY));
});

it("serves the key when the slash is percent-encoded", async () => {
  await insertPhoto(KEY);
  await putPhoto(KEY);

  await expectImage(`/images/${encodeURIComponent(KEY)}`);
});

it("returns image_not_found for a key that contains .. even if it is stored", async () => {
  const key = "photos/a..b.webp";
  await insertPhoto(key);
  await putPhoto(key);

  await expectMissing(imagePath(key));
});

it("serves a key that contains a space", async () => {
  const key = "photos/caja vacia.webp";
  await insertPhoto(key);
  await putPhoto(key);

  await expectImage(imagePath(key));
});

it("serves a key that contains a tilde", async () => {
  const key = "photos/ñandú.webp";
  await insertPhoto(key);
  await putPhoto(key);

  await expectImage(imagePath(key));
});

it("returns image_not_found when the key casing does not match", async () => {
  await insertPhoto(KEY);
  await putPhoto(KEY);

  await expectMissing(imagePath("photos/Caja.webp"));
});

it("serves a key of 200 characters", async () => {
  const key = "p".repeat(200);
  await insertPhoto(key);
  await putPhoto(key);

  await expectImage(imagePath(key));
});

it("returns image_not_found for a key longer than 200 characters", async () => {
  const key = "p".repeat(201);
  await insertPhoto(key);
  await putPhoto(key);

  await expectMissing(imagePath(key));
});

it("returns image_not_found for an empty key", async () => {
  await expectMissing("/images");
  await expectMissing("/images/");
});

it("serves a photo of a hidden product", async () => {
  const key = "photos/ramo-oculto.webp";
  await insertPhoto(key, 0);
  await putPhoto(key);

  await expectImage(imagePath(key));
});

it("does not serve a Yape capture that exists in R2", async () => {
  const key = "captures/not-a-photo.jpg";
  await putPhoto(key);

  await expectMissing(imagePath(key));
});

it("does not serve a capture key even when product_photos lists it", async () => {
  const key = "captures/not-a-photo.jpg";
  await insertPhoto(key);
  await putPhoto(key);

  await expectMissing(imagePath(key));
  await expectMissing(`/images/${encodeURIComponent(key)}`);
});

it("returns image_not_found for a photo key that is not listed", async () => {
  await putPhoto("photos/huerfana.webp");

  await expectMissing(imagePath("photos/huerfana.webp"));
});
