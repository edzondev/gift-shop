import { createMiddleware, createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseStatus } from "@tanstack/react-start/server";
import * as v from "valibot";
import { ORDER_STATUSES } from "./admin-action";
import {
  ACCESS_ASSERTION,
  postStatus,
  readCapture,
  readOrder,
  readOrders,
  readSummary,
} from "./admin-api";
import { limaTodayLabel } from "./admin-present";
import { ordersInput } from "./admin-search";

const directCall = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const followed = await next();
  if (
    ("result" in followed && followed.result !== undefined) ||
    !("kind" in followed) ||
    typeof followed.kind !== "string"
  ) {
    return followed;
  }
  const view: Record<string, unknown> = { kind: followed.kind };
  if ("status" in followed) view.status = followed.status;
  if ("summary" in followed) view.summary = followed.summary;
  if ("todayLabel" in followed) view.todayLabel = followed.todayLabel;
  if ("page" in followed) view.page = followed.page;
  if ("order" in followed) view.order = followed.order;
  return { ...followed, result: view };
});

function publish<T extends { kind: string; status?: number }>(view: T): T {
  if (view.kind === "denied" && (view.status === 401 || view.status === 403)) {
    setResponseStatus(view.status);
  }
  return view;
}

export const getAdminSummary = createServerFn({ method: "GET" })
  .middleware([directCall])
  .handler(async () => {
    return publish(
      await readSummary(getRequestHeader(ACCESS_ASSERTION), limaTodayLabel(new Date())),
    );
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([directCall])
  .validator((input: unknown) => ordersInput(input))
  .handler(async ({ data }) => {
    return publish(await readOrders(getRequestHeader(ACCESS_ASSERTION), ordersInput(data)));
  });

export const getAdminOrder = createServerFn({ method: "GET" })
  .middleware([directCall])
  .validator((input: unknown) => (typeof input === "string" ? input : ""))
  .handler(async ({ data }) => {
    if (data === "") return { kind: "missing" as const };
    return publish(await readOrder(getRequestHeader(ACCESS_ASSERTION), data));
  });

const statusInput = v.object({
  code: v.pipe(v.string(), v.minLength(1)),
  to: v.picklist(ORDER_STATUSES),
});

export const setAdminStatus = createServerFn({ method: "POST" })
  .middleware([directCall])
  .validator((input: unknown) => {
    const parsed = v.safeParse(statusInput, input);
    return parsed.success ? parsed.output : null;
  })
  .handler(async ({ data }) => {
    if (data === null) return { kind: "failed" as const };
    return publish(await postStatus(getRequestHeader(ACCESS_ASSERTION), data.code, data.to));
  });

export const serveCapture = createServerOnlyFn(async (request: Request, code: string) => {
  const header = request.headers.get(ACCESS_ASSERTION);
  return readCapture(header === null ? undefined : header, code);
});
