import type { OrderStatus } from "api";
import * as v from "valibot";
import { ORDER_STATUSES } from "./admin-action";
import { isRecord } from "./record";

const statusSchema = v.picklist(ORDER_STATUSES);

export type OrdersSearch = {
  status?: OrderStatus;
  q?: string;
};

export type OrdersRequest = {
  status?: OrderStatus;
  q?: string;
  cursor?: string;
};

export function ordersSearch(search: Record<string, unknown>): OrdersSearch {
  const status = v.safeParse(statusSchema, search.status);
  const q = v.safeParse(v.string(), search.q);
  const result: OrdersSearch = {};
  if (status.success) result.status = status.output;
  if (q.success && q.output !== "") result.q = q.output;
  return result;
}

export function ordersRequest(search: OrdersSearch & { cursor?: unknown }): OrdersRequest {
  const q = search.q?.trim() ?? "";
  const cursor = v.safeParse(v.pipe(v.string(), v.minLength(1)), search.cursor);
  const request: OrdersRequest = {};
  if (search.status !== undefined) request.status = search.status;
  if (q !== "") request.q = q;
  if (cursor.success) request.cursor = cursor.output;
  return request;
}

export function ordersInput(input: unknown): OrdersRequest {
  const record = isRecord(input) ? input : {};
  return ordersRequest({ ...ordersSearch(record), cursor: record.cursor });
}

export function ordersKey(request: OrdersRequest): { status?: OrderStatus; q?: string } {
  const key: { status?: OrderStatus; q?: string } = {};
  if (request.status !== undefined) key.status = request.status;
  if (request.q !== undefined) key.q = request.q;
  return key;
}
