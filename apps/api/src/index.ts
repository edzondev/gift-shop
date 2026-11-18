import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { type ApiEnv, notFound, onError } from "./errors";
import { products } from "./products/routes";

export const app = new Hono<ApiEnv>()
  .use(secureHeaders())
  .use(requestId())
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/products", products);

app.notFound(notFound);
app.onError(onError);

export type AppType = typeof app;
export type { Field, Occasion, Page, ProductCard, ProductDetail } from "./types";

export default app;
