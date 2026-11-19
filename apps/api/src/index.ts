import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { type ApiEnv, notFound, onError } from "./errors";
import { images } from "./images/routes";
import { orders } from "./orders/routes";
import { createOrderInputSchema } from "./orders/schemas";
import { products } from "./products/routes";

export const app = new Hono<ApiEnv>()
  .use(secureHeaders())
  .use(requestId())
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/products", products)
  .route("/images", images)
  .route("/orders", orders);

app.notFound(notFound);
app.onError(onError);

export type AppType = typeof app;
export type {
  CreatedOrder,
  CreateOrderInput,
  Delivery,
  Field,
  Occasion,
  OrderLine,
  OrderStatus,
  Page,
  ProductCard,
  ProductDetail,
  PublicOrder,
} from "./types";
export { createOrderInputSchema };

export default app;
