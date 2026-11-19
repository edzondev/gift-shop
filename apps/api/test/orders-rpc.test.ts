import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";
import { expect, it } from "vitest";
import type { AppType } from "../src/index";

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
