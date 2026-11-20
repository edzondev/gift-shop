import { createMiddleware, createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseStatus } from "@tanstack/react-start/server";
import * as v from "valibot";
import { ORDER_STATUSES } from "./admin-action";
import {
  captureResponse,
  postStatus,
  readCapture,
  readOrder,
  readOrders,
  readSummary,
} from "./admin-api";
import { limaTodayLabel } from "./admin-present";
import { ordersInput } from "./admin-search";
import { readSessionToken } from "./admin-session";

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

function sessionToken(): string | undefined {
  return readSessionToken(getRequestHeader("cookie") ?? null);
}

function publish<T extends { kind: string; status?: number }>(view: T): T {
  if (view.kind === "denied" && (view.status === 401 || view.status === 403)) {
    setResponseStatus(view.status);
  }
  return view;
}

export const getAdminSummary = createServerFn({ method: "GET" })
  .middleware([directCall])
  .handler(async () => {
    return publish(await readSummary(sessionToken(), limaTodayLabel(new Date())));
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([directCall])
  .validator((input: unknown) => ordersInput(input))
  .handler(async ({ data }) => {
    return publish(await readOrders(sessionToken(), ordersInput(data)));
  });

export const getAdminOrder = createServerFn({ method: "GET" })
  .middleware([directCall])
  .validator((input: unknown) => (typeof input === "string" ? input : ""))
  .handler(async ({ data }) => {
    if (data === "") return { kind: "missing" as const };
    return publish(await readOrder(sessionToken(), data));
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
    return publish(await postStatus(sessionToken(), data.code, data.to));
  });

export const serveCapture = createServerOnlyFn(async (request: Request, code: string) => {
  const token = readSessionToken(request.headers.get("cookie"));
  if (token === undefined) return captureResponse(new Response(null, { status: 401 }));
  return readCapture(token, code);
});
