import { Hono } from "hono";
import { validator } from "hono/validator";
import { type ApiEnv, productNotFound } from "../errors";
import { validationHook } from "../validation";
import { getProduct, listProducts } from "./queries";
import { listQuerySchema, slugParamSchema } from "./schemas";

export const products = new Hono<ApiEnv>()
  .get("/", validator("query", validationHook(listQuerySchema)), async (c) => {
    const page = await listProducts(c.env.DB, c.req.valid("query"));
    return c.json(page, 200);
  })
  .get("/:slug", validator("param", validationHook(slugParamSchema)), async (c) => {
    const product = await getProduct(c.env.DB, c.req.valid("param").slug);
    if (product === null) return c.json(productNotFound(), 404);
    return c.json(product, 200);
  });
