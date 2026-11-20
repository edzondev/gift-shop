import { beforeEach, expect, it } from "vitest";
import { getAdminSummary, serveCapture } from "../src/admin.functions";
import { summary } from "./admin-fixture";
import { resetApiFetch, setApiFetch } from "./cloudflare-workers-stub";
import { withAccessRequest } from "./start-request";

function requestOf(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? input : new Request(input, init);
}

beforeEach(() => {
  resetApiFetch();
});

it("forwards the admin_session cookie as a bearer token to the API", async () => {
  let seen: string | null = null;
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    seen = request.headers.get("authorization");
    return Response.json(summary);
  });
  const view = await withAccessRequest("jwt-de-prueba", () => getAdminSummary());
  expect(seen).toBe("Bearer jwt-de-prueba");
  expect(view.kind).toBe("ok");
});

it("does not invent an Authorization header when the request has no session cookie", async () => {
  let seen: string | null = "presente";
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    seen = request.headers.get("authorization");
    return new Response("", { status: 401 });
  });
  const view = await withAccessRequest(undefined, () => getAdminSummary());
  expect(seen).toBeNull();
  expect(view.kind).toBe("denied");
  expect(JSON.stringify(view)).not.toContain("customerName");
});

it("returns 401 no-store for evidencia without a session cookie and does not call the API", async () => {
  let called = false;
  setApiFetch(async () => {
    called = true;
    return new Response("SECRETO-CAPTURA", {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    });
  });
  const response = await serveCapture(
    new Request("https://taller.test/admin/evidencia/REG-2026-0012"),
    "REG-2026-0012",
  );
  expect(called).toBe(false);
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.text()).not.toContain("SECRETO-CAPTURA");
});

it("forwards the session cookie as a bearer token when reading evidencia", async () => {
  let seen: string | null = null;
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    seen = request.headers.get("authorization");
    return new Response(new Uint8Array([9]), { headers: { "content-type": "image/png" } });
  });
  const response = await serveCapture(
    new Request("https://taller.test/admin/evidencia/REG-2026-0012", {
      headers: { cookie: "admin_session=jwt-captura" },
    }),
    "REG-2026-0012",
  );
  expect(seen).toBe("Bearer jwt-captura");
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([9]));
});
