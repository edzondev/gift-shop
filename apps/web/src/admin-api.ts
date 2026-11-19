import { env } from "cloudflare:workers";
import type { AdminOrder, AdminOrderRow, AdminSummary, AppType, OrderStatus, Page } from "api";
import { hc } from "hono/client";
import {
  isInvalidTransition,
  parseAdminOrder,
  parseAdminSummary,
  parseOrderPage,
} from "./admin-json";
import type { StatusUpdate } from "./admin-orders-page";
import type { OrdersRequest } from "./admin-search";

export const ACCESS_ASSERTION = "Cf-Access-Jwt-Assertion";

type StatusResponse = {
  status: number;
  ok: boolean;
  json: () => Promise<unknown>;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
};

export type Denied = { kind: "denied"; status: 401 | 403 };

export type SummaryView =
  | { kind: "ok"; summary: AdminSummary; todayLabel: string }
  | Denied
  | { kind: "failed" };

export type OrdersView = { kind: "ok"; page: Page<AdminOrderRow> } | Denied | { kind: "failed" };

export type OrderView =
  | { kind: "ok"; order: AdminOrder }
  | { kind: "missing" }
  | Denied
  | { kind: "failed" };

export function accessHeaders(assertion: string | undefined): Record<string, string> {
  if (assertion === undefined || assertion === "") return {};
  return { [ACCESS_ASSERTION]: assertion };
}

function api(assertion: string | undefined) {
  return hc<AppType>("http://api", {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => env.API.fetch(input, init),
    headers: accessHeaders(assertion),
  });
}

function denied(status: number): status is 401 | 403 {
  return status === 401 || status === 403;
}

export async function summaryFromResponse(
  response: StatusResponse,
  todayLabel: string,
): Promise<SummaryView> {
  if (denied(response.status)) return { kind: "denied", status: response.status };
  if (!response.ok) return { kind: "failed" };
  const body = await response.json();
  const summary = parseAdminSummary(body);
  if (summary === null) return { kind: "failed" };
  return { kind: "ok", summary, todayLabel };
}

export async function ordersFromResponse(response: StatusResponse): Promise<OrdersView> {
  if (denied(response.status)) return { kind: "denied", status: response.status };
  if (!response.ok) return { kind: "failed" };
  const body = await response.json();
  const page = parseOrderPage(body);
  if (page === null) return { kind: "failed" };
  return { kind: "ok", page };
}

export async function orderFromResponse(response: StatusResponse): Promise<OrderView> {
  if (denied(response.status)) return { kind: "denied", status: response.status };
  if (response.status === 404) return { kind: "missing" };
  if (!response.ok) return { kind: "failed" };
  const body = await response.json();
  const order = parseAdminOrder(body);
  if (order === null) return { kind: "failed" };
  return { kind: "ok", order };
}

export async function statusFromResponse(response: StatusResponse): Promise<StatusUpdate> {
  if (denied(response.status)) return { kind: "denied", status: response.status };
  if (response.status === 409) {
    const body = await response.json();
    return isInvalidTransition(body) ? { kind: "rejected_transition" } : { kind: "failed" };
  }
  if (!response.ok) return { kind: "failed" };
  const body = await response.json();
  const order = parseAdminOrder(body);
  if (order === null) return { kind: "failed" };
  return { kind: "updated", order };
}

function ordersUrl(request: OrdersRequest): string {
  const params = new URLSearchParams();
  if (request.status !== undefined) params.set("status", request.status);
  if (request.q !== undefined) params.set("q", request.q);
  if (request.cursor !== undefined) params.set("cursor", request.cursor);
  const query = params.toString();
  return query === "" ? "http://api/admin/orders" : `http://api/admin/orders?${query}`;
}

export async function readSummary(
  assertion: string | undefined,
  todayLabel: string,
): Promise<SummaryView> {
  const response = await api(assertion).admin.summary.$get();
  return summaryFromResponse(response, todayLabel);
}

export async function readOrders(
  assertion: string | undefined,
  request: OrdersRequest,
): Promise<OrdersView> {
  const response = await env.API.fetch(ordersUrl(request), { headers: accessHeaders(assertion) });
  return ordersFromResponse(response);
}

export async function readOrder(assertion: string | undefined, code: string): Promise<OrderView> {
  const response = await api(assertion).admin.orders[":code"].$get({ param: { code } });
  return orderFromResponse(response);
}

export async function postStatus(
  assertion: string | undefined,
  code: string,
  to: OrderStatus,
): Promise<StatusUpdate> {
  const response = await api(assertion).admin.orders[":code"].status.$post({
    param: { code },
    json: { to },
  });
  return statusFromResponse(response);
}

const PRIVATE_CAPTURE = "private, no-store";

export function captureResponse(upstream: StatusResponse): Response {
  if (denied(upstream.status)) {
    return new Response("Sin acceso", {
      status: upstream.status,
      headers: {
        "cache-control": PRIVATE_CAPTURE,
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
  const headers = new Headers();
  const type = upstream.headers.get("content-type");
  if (type !== null) headers.set("content-type", type);
  const etag = upstream.headers.get("etag");
  if (etag !== null) headers.set("etag", etag);
  headers.set("cache-control", PRIVATE_CAPTURE);
  return new Response(upstream.body, { status: upstream.status, headers });
}

export async function readCapture(assertion: string | undefined, code: string): Promise<Response> {
  const response = await api(assertion).admin.orders[":code"].capture.$get({ param: { code } });
  return captureResponse(response);
}
