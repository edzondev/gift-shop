import type { AdminProduct, Page, ProductInput } from "api";
import { adminClient, type Denied } from "./admin-api";
import {
  errorCode,
  errorIssues,
  parseAdminProduct,
  parseAdminProductPage,
} from "./admin-product-json";
import { readJsonLimited } from "./limited-json";
import { type FieldMessages, fieldsFromApiIssues } from "./product-errors";
import type { ProductPatch } from "./product-form";

const JSON_LIMIT = 1_048_576;

export type ProductsView = { kind: "ok"; page: Page<AdminProduct> } | Denied | { kind: "failed" };

export type ProductView =
  | { kind: "ok"; product: AdminProduct }
  | { kind: "missing" }
  | Denied
  | { kind: "failed" };

export type WriteView =
  | { kind: "saved"; product: AdminProduct }
  | { kind: "unchanged"; product: AdminProduct }
  | { kind: "slug_taken" }
  | { kind: "invalid"; fields: FieldMessages }
  | { kind: "missing" }
  | Denied
  | { kind: "failed" };

export type StockView =
  | { kind: "updated"; product: AdminProduct }
  | { kind: "out_of_stock" }
  | { kind: "missing" }
  | Denied
  | { kind: "failed" };

function deniedStatus(status: number): status is 401 | 403 {
  return status === 401 || status === 403;
}

async function payload(response: { body: ReadableStream | null }): Promise<unknown> {
  return readJsonLimited(response.body, JSON_LIMIT);
}

export function classifyWrite(status: number, body: unknown): WriteView {
  if (deniedStatus(status)) return { kind: "denied", status };
  const code = errorCode(body);
  if (status === 404 && code === "product_not_found") return { kind: "missing" };
  if (status === 409 && code === "slug_taken") return { kind: "slug_taken" };
  if (status === 422 && code === "validation_error") {
    const issues = errorIssues(body);
    if (issues === null) return { kind: "failed" };
    return { kind: "invalid", fields: fieldsFromApiIssues(issues).fields };
  }
  if (status === 200 || status === 201) {
    const product = parseAdminProduct(body);
    if (product === null) return { kind: "failed" };
    return { kind: "saved", product };
  }
  return { kind: "failed" };
}

export function classifyStock(status: number, body: unknown): StockView {
  if (deniedStatus(status)) return { kind: "denied", status };
  if (status === 404 && errorCode(body) === "product_not_found") return { kind: "missing" };
  if (status === 409 && errorCode(body) === "out_of_stock") return { kind: "out_of_stock" };
  if (status === 200) {
    const product = parseAdminProduct(body);
    if (product === null) return { kind: "failed" };
    return { kind: "updated", product };
  }
  return { kind: "failed" };
}

export async function readProducts(
  token: string | undefined,
  cursor: string | undefined,
): Promise<ProductsView> {
  const response = await adminClient(token).admin.products.$get({
    query: { cursor, limit: "20" },
  });
  if (deniedStatus(response.status)) return { kind: "denied", status: response.status };
  if (!response.ok) return { kind: "failed" };
  const page = parseAdminProductPage(await payload(response));
  if (page === null) return { kind: "failed" };
  return { kind: "ok", page };
}

export async function readProductById(token: string | undefined, id: string): Promise<ProductView> {
  try {
    const response = await adminClient(token).admin.products[":id"].$get({ param: { id } });
    const status = response.status;
    if (deniedStatus(status)) return { kind: "denied", status };
    if (status === 404) {
      if (errorCode(await payload(response)) === "product_not_found") return { kind: "missing" };
      return { kind: "failed" };
    }
    if (status !== 200) return { kind: "failed" };
    const product = parseAdminProduct(await payload(response));
    if (product === null) return { kind: "failed" };
    return { kind: "ok", product };
  } catch {
    return { kind: "failed" };
  }
}

export async function createProduct(
  token: string | undefined,
  input: ProductInput,
): Promise<WriteView> {
  const response = await adminClient(token).admin.products.$post({ json: input });
  return classifyWrite(response.status, await payload(response));
}

export async function patchProduct(
  token: string | undefined,
  id: string,
  patch: ProductPatch,
): Promise<WriteView> {
  const response = await adminClient(token).admin.products[":id"].$patch({
    param: { id },
    json: patch,
  });
  return classifyWrite(response.status, await payload(response));
}

export async function postStock(
  token: string | undefined,
  id: string,
  delta: number,
): Promise<StockView> {
  const response = await adminClient(token).admin.products[":id"].stock.$post({
    param: { id },
    json: { delta },
  });
  return classifyStock(response.status, await payload(response));
}
