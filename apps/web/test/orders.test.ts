import { isNotFound } from "@tanstack/react-router";
import { expect, it } from "vitest";
import { attemptKey, claimSubmit, markCleared } from "../src/orders/attempt";
import {
  interpretOrderPost,
  ORDER_ERROR_CODES,
  orderErrorMessage,
  readOrderPost,
  readPublicOrderResponse,
  rejectMissing,
} from "../src/orders/result";

it("maps every order error to a Spanish message", () => {
  for (const code of ORDER_ERROR_CODES) {
    const message = orderErrorMessage(code);
    expect(message.length).toBeGreaterThan(0);
    expect(interpretOrderPost(409, { error: { code, message: "x" } }).ok).toBe(false);
  }
  const changed = interpretOrderPost(409, {
    error: { code: "price_changed", message: "Price changed" },
  });
  expect(changed.ok).toBe(false);
  if (changed.ok) return;
  expect(changed.message).toContain("carrito");
  const soon = interpretOrderPost(422, {
    error: { code: "delivery_date_too_soon", message: "soon" },
  });
  expect(soon.ok).toBe(false);
  if (soon.ok) return;
  expect(soon.message.toLowerCase()).toContain("fecha");
});

it("reads the status before the body", async () => {
  const calls: string[] = [];
  const response = {
    get status() {
      calls.push("status");
      return 409;
    },
    json() {
      if (calls[0] !== "status") throw new Error("body before status");
      calls.push("json");
      return Promise.resolve({ error: { code: "out_of_stock", message: "Not enough stock" } });
    },
  };
  const result = await readOrderPost(response);
  expect(calls).toEqual(["status", "json"]);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.message).toContain("stock");

  const created = await readOrderPost({
    status: 201,
    json: async () => ({
      code: "REG-2026-0008",
      token: "abc",
      status: "por_verificar",
      totalCents: 4500,
    }),
  });
  expect(created).toEqual({ ok: true, code: "REG-2026-0008", token: "abc" });
});

it("reuses the idempotency key for the same attempt", () => {
  let created = 0;
  const create = () => {
    created += 1;
    return `key-${created}`;
  };
  const first = attemptKey(null, "same", create);
  const retry = attemptKey(first, "same", create);
  expect(retry).toBe(first);
  expect(created).toBe(1);
  const changed = attemptKey(retry, "other", create);
  expect(changed.key).toBe("key-2");
  expect(created).toBe(2);
});

it("sends once and clears the cart once", () => {
  const submitting = { current: false };
  expect(claimSubmit(submitting)).toBe(true);
  expect(claimSubmit(submitting)).toBe(false);
  const cleared = { current: false };
  expect(markCleared(cleared)).toBe(true);
  expect(markCleared(cleared)).toBe(false);
});

it("turns a missing order into notFound", async () => {
  expect(() => rejectMissing(200)).not.toThrow();
  try {
    rejectMissing(404);
    expect.unreachable("404 should notFound");
  } catch (error) {
    expect(isNotFound(error)).toBe(true);
  }

  const calls: string[] = [];
  const missing = readPublicOrderResponse({
    get status() {
      calls.push("status");
      return 404;
    },
    json() {
      if (!calls.includes("status")) throw new Error("body before status");
      calls.push("json");
      return Promise.resolve({});
    },
  });
  await expect(missing).rejects.toSatisfy(isNotFound);
  expect(calls).toEqual(["status"]);
});
