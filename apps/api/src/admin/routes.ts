import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { validator } from "hono/validator";
import {
  type ApiEnv,
  fileTooLarge,
  internalError,
  invalidCredentials,
  invalidTransition,
  orderNotFound,
  outOfStock,
  payloadTooLarge,
  photoNotFound,
  productNotFound,
  slugTaken,
  tooManyPhotos,
  unsupportedFileType,
  validationError,
} from "../errors";
import { MAX_BODY_BYTES } from "../orders/logic";
import type { AdminLoginResponse, AdminMeResponse } from "../types";
import { validationHook } from "../validation";
import { adminAuth, createSession, LOGIN_MAX_BYTES, parseLogin } from "./auth";
import {
  addProductPhoto,
  adjustStock,
  createProduct,
  deleteProductPhoto,
  listAdminProducts,
  patchProduct,
  readAdminProduct,
} from "./product-queries";
import { readAdminOrder, readCapture, readSummary, searchOrders, setOrderStatus } from "./queries";
import {
  adminProductsQuerySchema,
  ordersQuerySchema,
  productInputSchema,
  productPatchSchema,
  statusBodySchema,
  stockDeltaSchema,
} from "./schemas";

const orders = new Hono<ApiEnv>()
  .get("/", validator("query", validationHook(ordersQuerySchema)), async (c) => {
    const page = await searchOrders(c.env.DB, c.req.valid("query"));
    return c.json(page, 200);
  })
  .get("/:code/capture", async (c) => {
    const capture = await readCapture(c.env.DB, c.env.FILES, c.req.param("code"));
    if (capture === null) return c.json(orderNotFound(), 404);
    return c.body(capture.body, 200, {
      "cache-control": "private, no-store",
      "content-type": capture.contentType,
    });
  })
  .get("/:code", async (c) => {
    const order = await readAdminOrder(c.env.DB, c.req.param("code"));
    if (order === null) return c.json(orderNotFound(), 404);
    return c.json(order, 200);
  })
  .post("/:code/status", validator("json", validationHook(statusBodySchema)), async (c) => {
    const result = await setOrderStatus(c.env.DB, {
      code: c.req.param("code"),
      to: c.req.valid("json").to,
      now: new Date(),
    });
    if (result.type === "not_found") return c.json(orderNotFound(), 404);
    if (result.type === "invalid_transition") return c.json(invalidTransition(), 409);
    return c.json(result.order, 200);
  });

const products = new Hono<ApiEnv>()
  .get("/", validator("query", validationHook(adminProductsQuerySchema)), async (c) => {
    const page = await listAdminProducts(c.env.DB, c.req.valid("query"));
    return c.json(page, 200);
  })
  .get("/:id", async (c) => {
    const product = await readAdminProduct(c.env.DB, c.req.param("id"));
    if (product === null) return c.json(productNotFound(), 404);
    return c.json(product, 200);
  })
  .post("/", validator("json", validationHook(productInputSchema)), async (c) => {
    const result = await createProduct(c.env.DB, c.req.valid("json"), new Date());
    if (result.type === "slug_taken") return c.json(slugTaken(), 409);
    return c.json(result.product, 201);
  })
  .patch("/:id", validator("json", validationHook(productPatchSchema)), async (c) => {
    const result = await patchProduct(c.env.DB, c.req.param("id"), c.req.valid("json"));
    if (result.type === "not_found") return c.json(productNotFound(), 404);
    if (result.type === "slug_taken") return c.json(slugTaken(), 409);
    return c.json(result.product, 200);
  })
  .post("/:id/stock", validator("json", validationHook(stockDeltaSchema)), async (c) => {
    const id = c.req.param("id");
    const result = await adjustStock(c.env.DB, id, c.req.valid("json").delta);
    if (result.type === "not_found") return c.json(productNotFound(), 404);
    if (result.type === "out_of_stock") return c.json(outOfStock([id]), 409);
    return c.json(result.product, 200);
  })
  .post(
    "/:id/photos",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json(fileTooLarge(), 413),
    }),
    async (c) => {
      const body = await c.req.parseBody();
      const photo = body.photo;
      if (!(photo instanceof File)) {
        return c.json(validationError([{ path: "photo", message: "photo must be a file" }]), 422);
      }
      const result = await addProductPhoto(c.env.DB, c.env.FILES, {
        productId: c.req.param("id"),
        bytes: new Uint8Array(await photo.arrayBuffer()),
      });
      switch (result.type) {
        case "not_found":
          return c.json(productNotFound(), 404);
        case "file_too_large":
          return c.json(fileTooLarge(), 413);
        case "unsupported_file_type":
          return c.json(unsupportedFileType(), 415);
        case "too_many":
          return c.json(tooManyPhotos(), 409);
        case "created":
          return c.json({ id: result.id, key: result.key }, 201);
      }
    },
  )
  .delete("/:id/photos/:photoId", async (c) => {
    const deleted = await deleteProductPhoto(
      c.env.DB,
      c.env.FILES,
      c.req.param("id"),
      c.req.param("photoId"),
    );
    if (!deleted) return c.json(photoNotFound(), 404);
    return c.body(null, 204);
  });

export const admin = new Hono<ApiEnv>()
  .post(
    "/login",
    bodyLimit({
      maxSize: LOGIN_MAX_BYTES,
      onError: (c) => c.json(payloadTooLarge(), 413),
    }),
    async (c) => {
      const parsed = parseLogin(await c.req.text());
      if (!parsed.ok) return c.json(validationError(parsed.issues), 422);
      const session = await createSession(c.env, parsed.value);
      if (session.type === "misconfigured") return c.json(internalError(), 500);
      if (session.type === "rejected") return c.json(invalidCredentials(), 401);
      const body: AdminLoginResponse = {
        token: session.token,
        email: session.email,
        expiresAt: session.expiresAt,
      };
      return c.json(body, 200);
    },
  )
  .use("*", adminAuth)
  .get("/me", (c) => {
    const body: AdminMeResponse = { email: c.var.adminEmail };
    return c.json(body, 200);
  })
  .get("/summary", async (c) => {
    const summary = await readSummary(c.env.DB, new Date());
    return c.json(summary, 200);
  })
  .route("/orders", orders)
  .route("/products", products);
