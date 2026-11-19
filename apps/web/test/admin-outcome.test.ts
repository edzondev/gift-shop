import { expect, it } from "vitest";
import {
  captureResponse,
  orderFromResponse,
  ordersFromResponse,
  statusFromResponse,
  summaryFromResponse,
} from "../src/admin-api";
import { parseAdminOrder, parseAdminSummary } from "../src/admin-json";
import { order, summary } from "./admin-fixture";

it("maps 401 and 403 to denied without reading a payload", async () => {
  const secret = new Response("", { status: 401 });
  const forbidden = new Response("", { status: 403 });
  expect(await summaryFromResponse(secret, "hoy")).toEqual({ kind: "denied" });
  expect(await orderFromResponse(forbidden)).toEqual({ kind: "denied" });
  expect(await ordersFromResponse(new Response("", { status: 401 }))).toEqual({ kind: "denied" });
  expect(JSON.stringify(await statusFromResponse(new Response("", { status: 403 })))).not.toContain(
    "SECRETO",
  );
});

it("maps 404 to missing and 409 invalid_transition to a reload", async () => {
  expect(await orderFromResponse(new Response("", { status: 404 }))).toEqual({ kind: "missing" });
  expect(
    await statusFromResponse(
      Response.json(
        { error: { code: "invalid_transition", message: "Invalid transition" } },
        { status: 409 },
      ),
    ),
  ).toEqual({ kind: "rejected_transition" });
  expect(
    await statusFromResponse(Response.json({ error: { code: "conflict" } }, { status: 409 })),
  ).toEqual({
    kind: "failed",
  });
});

it("returns the POST order and drops fields that are not part of the order", async () => {
  const body = { ...order, secret: "SECRETO-PEDIDO" };
  const parsed = parseAdminOrder(body);
  expect(parsed?.status).toBe("por_verificar");
  expect(JSON.stringify(parsed)).not.toContain("SECRETO-PEDIDO");
  const update = await statusFromResponse(Response.json(body));
  expect(update.kind).toBe("updated");
  if (update.kind !== "updated") return;
  expect(update.order.customer.name).toBe(order.customer.name);
  expect(JSON.stringify(update.order)).not.toContain("SECRETO-PEDIDO");
  const view = await summaryFromResponse(Response.json({ ...summary, leak: "SECRETO" }), "Jueves");
  expect(view.kind).toBe("ok");
  expect(JSON.stringify(view)).not.toContain("SECRETO");
  expect(
    parseAdminSummary({ ...summary, pending: [{ ...summary.pending[0], status: "pagado" }] }),
  ).toBeNull();
});

it("streams a capture and replaces a denied body", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
  const upstream = new Response(stream, {
    status: 200,
    headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" },
  });
  const proxied = captureResponse(upstream);
  expect(proxied.body).toBe(upstream.body);
  expect(proxied.headers.get("content-type")).toBe("image/jpeg");
  expect(proxied.headers.get("cache-control")).toBe("private, no-store");

  const denied = captureResponse(
    new Response("SECRETO-CAPTURA", { status: 401, headers: { "content-type": "image/jpeg" } }),
  );
  expect(denied.status).toBe(401);
  expect(await denied.text()).toBe("Sin acceso");
  expect(denied.headers.get("content-type")).not.toContain("image/jpeg");
});
