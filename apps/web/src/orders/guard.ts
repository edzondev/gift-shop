import type { CreatedOrder, Delivery, OrderLine, OrderStatus, PublicOrder } from "api";
import { isRecord } from "../record";

const STATUSES = [
  "por_verificar",
  "confirmado",
  "en_preparacion",
  "listo",
  "entregado",
  "rechazado",
] as const satisfies readonly OrderStatus[];

function isStatus(value: unknown): value is OrderStatus {
  return STATUSES.some((status) => status === value);
}

function isOrderLine(value: unknown): value is OrderLine {
  if (!isRecord(value)) return false;
  return (
    typeof value.productName === "string" &&
    typeof value.qty === "number" &&
    Array.isArray(value.options) &&
    value.options.every((option) => typeof option === "string") &&
    (value.cardMessage === null || typeof value.cardMessage === "string") &&
    typeof value.lineTotalCents === "number"
  );
}

function isDelivery(value: unknown): value is Delivery {
  if (!isRecord(value)) return false;
  if (value.mode === "estacion") {
    return typeof value.station === "string" && typeof value.slot === "string";
  }
  if (value.mode === "delivery") {
    return typeof value.address === "string" && typeof value.district === "string";
  }
  return false;
}

export function isCreatedOrder(value: unknown): value is CreatedOrder {
  if (!isRecord(value)) return false;
  return (
    typeof value.code === "string" &&
    value.code.length > 0 &&
    typeof value.token === "string" &&
    value.token.length > 0 &&
    value.status === "por_verificar" &&
    typeof value.totalCents === "number"
  );
}

export function isPublicOrder(value: unknown): value is PublicOrder {
  if (!isRecord(value) || !isStatus(value.status) || !isDelivery(value.delivery)) return false;
  if (!Array.isArray(value.items) || !value.items.every(isOrderLine)) return false;
  if (typeof value.code !== "string" || typeof value.createdAt !== "string") return false;
  if (typeof value.deliveryDate !== "string" || typeof value.yapeOperation !== "string")
    return false;
  if (typeof value.subtotalCents !== "number") return false;
  if (value.deliveryCostCents !== null && typeof value.deliveryCostCents !== "number") return false;
  if (value.status === "rechazado") return typeof value.rejectedAt === "string";
  if (value.status === "entregado") {
    return typeof value.verifiedAt === "string" && typeof value.deliveredAt === "string";
  }
  if (value.status === "por_verificar") return true;
  return typeof value.verifiedAt === "string";
}
