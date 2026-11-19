import { createServerFn } from "@tanstack/react-start";
import { readCatalog, readProduct } from "./catalog-api";
import { catalogInput } from "./catalog-search";

export const listCatalog = createServerFn({ method: "GET" })
  .validator((input: unknown) => catalogInput(input))
  .handler(async ({ data }) => readCatalog(data));

export const getProduct = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    if (typeof input !== "string" || input.length === 0) {
      throw new Error("No pudimos cargar el producto");
    }
    return input;
  })
  .handler(async ({ data }) => readProduct(data));
