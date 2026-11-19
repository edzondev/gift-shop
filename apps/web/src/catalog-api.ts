import type { Occasion, Page, ProductCard, ProductDetail } from "api";
import { apiClient } from "./api-client";
import type { CatalogQuery } from "./catalog-search";
import { isProductDetail, isProductPage } from "./product-json";

type StatusResponse = {
  status: number;
  ok: boolean;
  json: () => Promise<unknown>;
};

export type ProductLookup = { kind: "found"; product: ProductDetail } | { kind: "missing" };

function queryOf(input: CatalogQuery): {
  occasion: Occasion | undefined;
  cursor: string | undefined;
  limit: string;
} {
  return {
    occasion: input.occasion,
    cursor: input.cursor,
    limit: "20",
  };
}

export async function pageFromResponse(
  response: StatusResponse,
  again: () => Promise<StatusResponse>,
): Promise<Page<ProductCard>> {
  const chosen = response.status === 422 ? await again() : response;
  if (!chosen.ok) throw new Error("No pudimos cargar el catálogo");
  const body = await chosen.json();
  if (!isProductPage(body)) throw new Error("No pudimos cargar el catálogo");
  return body;
}

export async function productFromResponse(response: StatusResponse): Promise<ProductLookup> {
  if (response.status === 404) return { kind: "missing" };
  if (!response.ok) throw new Error("No pudimos cargar el producto");
  const body = await response.json();
  if (!isProductDetail(body)) throw new Error("No pudimos cargar el producto");
  return { kind: "found", product: body };
}

export async function readCatalog(input: CatalogQuery): Promise<Page<ProductCard>> {
  const client = apiClient();
  const response = await client.products.$get({ query: queryOf(input) });
  return pageFromResponse(response, () =>
    client.products.$get({ query: queryOf({ occasion: undefined }) }),
  );
}

export async function readProduct(slug: string): Promise<ProductLookup> {
  const client = apiClient();
  const response = await client.products[":slug"].$get({ param: { slug } });
  return productFromResponse(response);
}
