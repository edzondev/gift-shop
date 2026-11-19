import { beforeEach, expect, it } from "vitest";
import { getAdminSummary, serveCapture } from "../src/admin.functions";
import { ACCESS_ASSERTION } from "../src/admin-api";
import { summary } from "./admin-fixture";
import { resetApiFetch, setApiFetch } from "./cloudflare-workers-stub";
import { withAccessRequest } from "./start-request";

function requestOf(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? input : new Request(input, init);
}

beforeEach(() => {
  resetApiFetch();
});

it("forwards Cf-Access-Jwt-Assertion from the incoming request to the API", async () => {
  let seen: string | null = null;
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    seen = request.headers.get(ACCESS_ASSERTION);
    return Response.json(summary);
  });
  const view = await withAccessRequest("jwt-de-prueba", () => getAdminSummary());
  expect(seen).toBe("jwt-de-prueba");
  expect(view.kind).toBe("ok");
});

it("does not invent an Access header when the request has none", async () => {
  let seen: string | null = "presente";
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    seen = request.headers.get(ACCESS_ASSERTION);
    return new Response("", { status: 401 });
  });
  const view = await withAccessRequest(undefined, () => getAdminSummary());
  expect(seen).toBeNull();
  expect(view.kind).toBe("denied");
  expect(JSON.stringify(view)).not.toContain("customerName");
});

it("forwards the Access header when streaming a capture", async () => {
  let seen: string | null = null;
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    seen = request.headers.get(ACCESS_ASSERTION);
    return new Response(new Uint8Array([9]), { headers: { "content-type": "image/png" } });
  });
  const response = await serveCapture(
    new Request("https://taller.test/admin/captura/REG-2026-0012", {
      headers: { [ACCESS_ASSERTION]: "jwt-captura" },
    }),
    "REG-2026-0012",
  );
  expect(seen).toBe("jwt-captura");
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([9]));
});
