import { hc } from "hono/client";
import { HTTPException } from "hono/http-exception";
import { expect, it } from "vitest";
import app, { type AppType } from "../src/index";

const rpc = hc<AppType>("http://gift-shop.local");
void rpc.health.$get;

app.get("/__test/throw", () => {
  throw new Error("unique-internal-detail");
});

app.get("/__test/http", () => {
  throw new HTTPException(409, { message: "Conflict" });
});

const NOT_FOUND = {
  error: { code: "not_found", message: "Not Found" },
};

const SECURE_HEADERS = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "origin-agent-cluster": "?1",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=15552000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-dns-prefetch-control": "off",
  "x-download-options": "noopen",
  "x-frame-options": "SAMEORIGIN",
  "x-permitted-cross-domain-policies": "none",
  "x-xss-protection": "0",
} as const;

async function expectNotFound(path: string): Promise<void> {
  const response = await app.request(path);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual(NOT_FOUND);
}

it("GET /health returns 200 and the exact body", async () => {
  const response = await app.request("/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

it("HEAD /health returns 200 and an empty body", async () => {
  const response = await app.request("/health", { method: "HEAD" });
  expect(response.status).toBe(200);
  expect(response.body).toBeNull();
  expect(await response.text()).toBe("");
});

it("GET /health includes the default secureHeaders", async () => {
  const response = await app.request("/health");
  expect(response.headers.get("x-powered-by")).toBeNull();
  for (const [name, value] of Object.entries(SECURE_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
});

it("sets x-request-id", async () => {
  const response = await app.request("/health");
  expect(response.headers.get("x-request-id")).toMatch(/^[\w-]{8,}$/);
});

it("unknown route returns 404 in the error format", async () => {
  await expectNotFound("/no-existe");
});

it("accented path returns 404 in the error format", async () => {
  await expectNotFound("/ñandú");
  await expectNotFound("/%C3%B1and%C3%BA");
});

it("emoji path returns 404 in the error format", async () => {
  await expectNotFound("/🎁");
});

it("very long path returns 404 in the error format", async () => {
  await expectNotFound(`/${"a".repeat(4000)}`);
});

it("POST /health misses the GET route and uses the error format", async () => {
  const response = await app.request("/health", { method: "POST" });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual(NOT_FOUND);
});

it("HTTPException keeps its status and the error format", async () => {
  const response = await app.request("/__test/http");
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: { code: "conflict", message: "Conflict" },
  });
});

it("a thrown error returns 500 without the internal message", async () => {
  const logged: string[] = [];
  const original = console.error;
  console.error = (message?: unknown) => {
    logged.push(typeof message === "string" ? message : JSON.stringify(message));
  };

  try {
    const response = await app.request("/__test/throw");
    const body: unknown = await response.json();
    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: { code: "internal_error", message: "Internal Server Error" },
    });
    expect(JSON.stringify(body)).not.toContain("unique-internal-detail");

    const raw = logged[0];
    if (typeof raw !== "string") {
      throw new Error("expected one structured console.error");
    }
    const entry: unknown = JSON.parse(raw);
    expect(entry).toEqual({
      code: "internal_error",
      method: "GET",
      path: "/__test/throw",
      requestId: expect.any(String),
      message: "unique-internal-detail",
    });
  } finally {
    console.error = original;
  }
});
