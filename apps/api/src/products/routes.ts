import type { Context } from "hono";
import { Hono } from "hono";
import { validator } from "hono/validator";
import * as v from "valibot";
import { type ApiEnv, productNotFound, validationError } from "../errors";
import { getProduct, listProducts } from "./queries";
import { listQuerySchema, slugParamSchema } from "./schemas";

function issuePath(issue: v.BaseIssue<unknown>): string {
  const keys: string[] = [];
  for (const item of issue.path ?? []) {
    if (typeof item.key === "string" || typeof item.key === "number") keys.push(String(item.key));
  }
  return keys.join(".");
}

function validationHook<Schema extends v.GenericSchema>(schema: Schema) {
  return (value: unknown, c: Context<ApiEnv>) => {
    const parsed = v.safeParse(schema, value);
    if (!parsed.success) {
      const issues = parsed.issues.map((issue) => ({
        path: issuePath(issue),
        message: issue.message,
      }));
      return c.json(validationError(issues), 422);
    }
    return parsed.output;
  };
}

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
