import { expect, it } from "vitest";
import { proxyProductImage } from "../src/image-proxy";
import { photoView } from "../src/photo";

const CACHE = "public, max-age=31536000, immutable";

function requestOf(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? input : new Request(input, init);
}

it("passes status, cache headers and the body stream", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Uint8Array.from([1, 2, 3, 4]));
      controller.close();
    },
  });
  let upstreamBody: ReadableStream<Uint8Array> | null = null;
  const response = await proxyProductImage("photos/a.webp", null, async (input, init) => {
    const request = requestOf(input, init);
    expect(request.method).toBe("GET");
    expect(request.headers.get("If-None-Match")).toBeNull();
    expect(new URL(request.url).pathname).toBe("/images/photos/a.webp");
    const upstream = new Response(stream, {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "cache-control": CACHE,
        etag: '"abc"',
        "x-request-id": "secret",
      },
    });
    upstreamBody = upstream.body;
    return upstream;
  });
  expect(response.body).toBe(upstreamBody);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("cache-control")).toBe(CACHE);
  expect(response.headers.get("etag")).toBe('"abc"');
  expect(response.headers.get("x-request-id")).toBeNull();
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(Uint8Array.from([1, 2, 3, 4]));
});

it("returns the API 404", async () => {
  const response = await proxyProductImage("no-existe.webp", null, async () => {
    return new Response(JSON.stringify({ error: { code: "image_not_found" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  });
  expect(response.status).toBe(404);
  expect(response.headers.get("content-type")).toBe("application/json");
});

it("forwards If-None-Match and returns 304 with the same etag", async () => {
  const etag = '"photo"';
  const response = await proxyProductImage("photos/a.webp", etag, async (input, init) => {
    const request = requestOf(input, init);
    expect(request.headers.get("If-None-Match")).toBe(etag);
    return new Response(null, {
      status: 304,
      headers: { etag, "cache-control": CACHE },
    });
  });
  expect(response.status).toBe(304);
  expect(response.headers.get("etag")).toBe(etag);
  expect(response.headers.get("cache-control")).toBe(CACHE);
  expect(response.body).toBeNull();
});

it("does not call the API for an empty key or a key with ..", async () => {
  let calls = 0;
  const fetchImage = async () => {
    calls += 1;
    return new Response(null, { status: 200 });
  };
  for (const key of ["", "../x", "a/../../etc", "..%2Fx"]) {
    const response = await proxyProductImage(key, null, fetchImage);
    expect(response.status).toBe(404);
  }
  expect(calls).toBe(0);
});

it("encodes each segment so the API receives the same key", async () => {
  const key = "fotos/día de mamá/100%.webp";
  const view = photoView({
    photoKey: key,
    label: "Día 🎁",
    frame: "main",
    priority: false,
    broken: false,
  });
  expect(view.kind).toBe("image");
  if (view.kind !== "image") return;
  let seen = "";
  await proxyProductImage(key, null, async (input, init) => {
    seen = new URL(requestOf(input, init).url).pathname.slice("/images/".length);
    return new Response(null, { status: 404 });
  });
  expect(seen).toBe("fotos/d%C3%ADa%20de%20mam%C3%A1/100%25.webp");
  expect(decodeURIComponent(seen)).toBe(key);
  expect(view.src).toBe(`/img/${seen}`);
});
