import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { type ApiEnv, notFound, onError } from "./errors";

export const app = new Hono<ApiEnv>()
  .use(secureHeaders())
  .use(requestId())
  .get("/health", (c) => c.json({ status: "ok" }));

app.notFound(notFound);
app.onError(onError);

export type AppType = typeof app;

export default app;
