import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";
import { expect, it } from "vitest";
import type { AdminOrder, AdminProduct, AppType } from "../src/index";

const client = hc<AppType>("http://gift-shop.local");

type Post = typeof client.orders.$post;
type Created = InferResponseType<Post, 201>;
type Conflict = InferResponseType<Post, 409>;
type Invalid = InferResponseType<Post, 422>;

type Known<T> = [T] extends [never] ? false : true;

it("types POST /orders 201, 409 and 422 on hc<AppType>", () => {
  const created: Known<Created> = true;
  const conflict: Known<Conflict> = true;
  const invalid: Known<Invalid> = true;
  const createdBody: Created extends { code: string; token: string; totalCents: number }
    ? true
    : false = true;
  const conflictBody: Conflict extends { error: { code: string; message: string } } ? true : false =
    true;
  const invalidBody: Invalid extends { error: { code: string; message: string } } ? true : false =
    true;
  expect([created, conflict, invalid, createdBody, conflictBody, invalidBody]).toEqual([
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
});

type StatusPost = (typeof client.admin.orders)[":code"]["status"]["$post"];
type StatusOk = InferResponseType<StatusPost, 200>;
type StatusConflict = InferResponseType<StatusPost, 409>;

it("types POST /admin/orders/:code/status 200 and 409 on hc<AppType>", () => {
  const ok: Known<StatusOk> = true;
  const conflict: Known<StatusConflict> = true;
  const okBody: StatusOk extends AdminOrder ? true : false = true;
  const conflictBody: StatusConflict extends { error: { code: "invalid_transition" } }
    ? true
    : false = true;
  expect([ok, conflict, okBody, conflictBody]).toEqual([true, true, true, true]);
});

type ProductPost = typeof client.admin.products.$post;
type ProductCreated = InferResponseType<ProductPost, 201>;
type ProductConflict = InferResponseType<ProductPost, 409>;

it("types POST /admin/products 201 and 409 on hc<AppType>", () => {
  const created: Known<ProductCreated> = true;
  const conflict: Known<ProductConflict> = true;
  const createdBody: ProductCreated extends AdminProduct ? true : false = true;
  const conflictBody: ProductConflict extends { error: { code: "slug_taken" } } ? true : false =
    true;
  expect([created, conflict, createdBody, conflictBody]).toEqual([true, true, true, true]);
});

type StockPost = (typeof client.admin.products)[":id"]["stock"]["$post"];
type StockOk = InferResponseType<StockPost, 200>;
type StockConflict = InferResponseType<StockPost, 409>;

it("types POST /admin/products/:id/stock 200 and 409 on hc<AppType>", () => {
  const ok: Known<StockOk> = true;
  const conflict: Known<StockConflict> = true;
  const okBody: StockOk extends AdminProduct ? true : false = true;
  const conflictBody: StockConflict extends { error: { code: "out_of_stock" } } ? true : false =
    true;
  expect([ok, conflict, okBody, conflictBody]).toEqual([true, true, true, true]);
});
