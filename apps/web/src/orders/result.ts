import { notFound } from "@tanstack/react-router";
import type { PublicOrder } from "api";
import * as v from "valibot";
import { isCreatedOrder, isPublicOrder } from "./guard";

export const ORDER_ERROR_CODES = [
  "delivery_date_too_soon",
  "product_unavailable",
  "out_of_stock",
  "price_changed",
  "idempotency_conflict",
  "file_too_large",
  "unsupported_file_type",
  "validation_error",
] as const;

export type OrderErrorCode = (typeof ORDER_ERROR_CODES)[number];

export function isOrderErrorCode(code: string): code is OrderErrorCode {
  switch (code) {
    case "delivery_date_too_soon":
    case "product_unavailable":
    case "out_of_stock":
    case "price_changed":
    case "idempotency_conflict":
    case "file_too_large":
    case "unsupported_file_type":
    case "validation_error":
      return true;
    default:
      return false;
  }
}

export function orderErrorMessage(code: OrderErrorCode): string {
  switch (code) {
    case "delivery_date_too_soon":
      return "Esa fecha es muy pronto. Elige desde el día mínimo que te mostramos.";
    case "product_unavailable":
      return "Hay un regalo que ya no está disponible. Revisa el carrito.";
    case "out_of_stock":
      return "No alcanza el stock de algún regalo. Revisa las cantidades del carrito.";
    case "price_changed":
      return "El precio cambió. Revisa el carrito antes de volver a enviar.";
    case "idempotency_conflict":
      return "Este envío ya se usó con otros datos. Vuelve a intentar el pedido.";
    case "file_too_large":
      return "La captura supera 5 MB. Sube una imagen más liviana.";
    case "unsupported_file_type":
      return "La captura tiene que ser JPG, PNG o WebP.";
    case "validation_error":
      return "Hay datos del pedido que no pasan la validación. Revísalos.";
    default: {
      const neverCode: never = code;
      return neverCode;
    }
  }
}

export type PlaceOrderResult =
  | { ok: true; code: string; token: string }
  | { ok: false; message: string };

const errorSchema = v.object({
  error: v.object({
    code: v.string(),
  }),
});

const FALLBACK = "No pudimos enviar el pedido. Inténtalo de nuevo.";

export function interpretOrderPost(status: number, body: unknown): PlaceOrderResult {
  if (status === 201 || status === 200) {
    if (!isCreatedOrder(body)) return { ok: false, message: orderErrorMessage("validation_error") };
    return { ok: true, code: body.code, token: body.token };
  }
  const error = v.safeParse(errorSchema, body);
  if (!error.success) return { ok: false, message: FALLBACK };
  const code = error.output.error.code;
  if (!isOrderErrorCode(code)) return { ok: false, message: FALLBACK };
  return { ok: false, message: orderErrorMessage(code) };
}

export type StatusBody = {
  readonly status: number;
  json: () => Promise<unknown>;
};

export async function readOrderPost(response: StatusBody): Promise<PlaceOrderResult> {
  const status = response.status;
  const body = await response.json();
  return interpretOrderPost(status, body);
}

export function orderFound(status: number): boolean {
  return status === 200;
}

export function rejectMissing(status: number): void {
  if (!orderFound(status)) throw notFound();
}

export async function readPublicOrderResponse(response: StatusBody): Promise<PublicOrder> {
  const status = response.status;
  rejectMissing(status);
  const body = await response.json();
  if (!isPublicOrder(body)) throw notFound();
  return body;
}
