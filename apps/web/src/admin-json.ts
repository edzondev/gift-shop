import type {
  AdminOrder,
  AdminOrderRow,
  AdminSummary,
  Delivery,
  OrderLine,
  OrderStatus,
  Page,
} from "api";
import { ORDER_STATUSES } from "./admin-action";
import { isRecord } from "./record";

type Station = Extract<Delivery, { mode: "estacion" }>["station"];
type Slot = Extract<Delivery, { mode: "estacion" }>["slot"];

const STATIONS = [
  "Bayóvar",
  "Santa Rosa",
  "San Martín",
  "San Carlos",
  "Los Postes",
  "Los Jardines",
  "Pirámide del Sol",
  "Caja de Agua",
] as const satisfies readonly Station[];

const SLOTS = ["manana", "tarde", "noche"] as const satisfies readonly Slot[];

function isStation(value: unknown): value is Station {
  return STATIONS.some((station) => station === value);
}

function isSlot(value: unknown): value is Slot {
  return SLOTS.some((slot) => slot === value);
}

function isStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.some((status) => status === value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function deliveryFrom(value: unknown): Delivery | null {
  if (!isRecord(value)) return null;
  if (value.mode === "estacion" && isStation(value.station) && isSlot(value.slot)) {
    return { mode: "estacion", station: value.station, slot: value.slot };
  }
  if (
    value.mode === "delivery" &&
    typeof value.address === "string" &&
    typeof value.district === "string"
  ) {
    if (value.reference === undefined) {
      return { mode: "delivery", address: value.address, district: value.district };
    }
    if (typeof value.reference === "string") {
      return {
        mode: "delivery",
        address: value.address,
        district: value.district,
        reference: value.reference,
      };
    }
  }
  return null;
}

type OrderState =
  | { status: "por_verificar" }
  | { status: "confirmado"; verifiedAt: string }
  | { status: "en_preparacion"; verifiedAt: string }
  | { status: "listo"; verifiedAt: string }
  | { status: "entregado"; verifiedAt: string; deliveredAt: string }
  | { status: "rechazado"; rejectedAt: string };

function stateFrom(value: Record<string, unknown>): OrderState | null {
  if (!isStatus(value.status)) return null;
  switch (value.status) {
    case "por_verificar":
      return { status: "por_verificar" };
    case "confirmado":
      return typeof value.verifiedAt === "string"
        ? { status: "confirmado", verifiedAt: value.verifiedAt }
        : null;
    case "en_preparacion":
      return typeof value.verifiedAt === "string"
        ? { status: "en_preparacion", verifiedAt: value.verifiedAt }
        : null;
    case "listo":
      return typeof value.verifiedAt === "string"
        ? { status: "listo", verifiedAt: value.verifiedAt }
        : null;
    case "entregado":
      return typeof value.verifiedAt === "string" && typeof value.deliveredAt === "string"
        ? { status: "entregado", verifiedAt: value.verifiedAt, deliveredAt: value.deliveredAt }
        : null;
    case "rechazado":
      return typeof value.rejectedAt === "string"
        ? { status: "rechazado", rejectedAt: value.rejectedAt }
        : null;
    default: {
      const exhaustive: never = value.status;
      return exhaustive;
    }
  }
}

function rowBase(value: Record<string, unknown>) {
  const delivery = deliveryFrom(value.delivery);
  if (delivery === null) return null;
  if (typeof value.code !== "string" || typeof value.customerName !== "string") return null;
  if (typeof value.itemsShort !== "string" || typeof value.deliveryDate !== "string") return null;
  if (typeof value.createdAt !== "string" || !finite(value.totalCents)) return null;
  return {
    code: value.code,
    customerName: value.customerName,
    itemsShort: value.itemsShort,
    delivery,
    deliveryDate: value.deliveryDate,
    totalCents: value.totalCents,
    createdAt: value.createdAt,
  };
}

export function parseAdminOrderRow(value: unknown): AdminOrderRow | null {
  if (!isRecord(value)) return null;
  const base = rowBase(value);
  const state = stateFrom(value);
  if (base === null || state === null) return null;
  return { ...base, ...state };
}

function lineFrom(value: unknown): OrderLine | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.productName !== "string" ||
    !finite(value.qty) ||
    !finite(value.lineTotalCents)
  ) {
    return null;
  }
  if (!Array.isArray(value.options) || !value.options.every((item) => typeof item === "string")) {
    return null;
  }
  if (value.cardMessage !== null && typeof value.cardMessage !== "string") return null;
  return {
    productName: value.productName,
    qty: value.qty,
    options: value.options,
    cardMessage: value.cardMessage,
    lineTotalCents: value.lineTotalCents,
  };
}

export function parseAdminOrder(value: unknown): AdminOrder | null {
  if (!isRecord(value)) return null;
  const delivery = deliveryFrom(value.delivery);
  const state = stateFrom(value);
  const customer = value.customer;
  if (delivery === null || state === null || !isRecord(customer)) return null;
  if (typeof value.code !== "string" || typeof value.createdAt !== "string") return null;
  if (typeof value.deliveryDate !== "string" || typeof value.yapeOperation !== "string")
    return null;
  if (!finite(value.subtotalCents)) return null;
  if (value.deliveryCostCents !== null && !finite(value.deliveryCostCents)) return null;
  if (value.note !== null && typeof value.note !== "string") return null;
  if (typeof customer.name !== "string" || typeof customer.phone !== "string") return null;
  if (customer.email !== null && typeof customer.email !== "string") return null;
  if (!Array.isArray(value.items)) return null;
  const items: OrderLine[] = [];
  for (const item of value.items) {
    const line = lineFrom(item);
    if (line === null) return null;
    items.push(line);
  }
  return {
    ...state,
    code: value.code,
    createdAt: value.createdAt,
    delivery,
    deliveryDate: value.deliveryDate,
    items,
    subtotalCents: value.subtotalCents,
    deliveryCostCents: value.deliveryCostCents,
    yapeOperation: value.yapeOperation,
    customer: { name: customer.name, phone: customer.phone, email: customer.email },
    note: value.note,
  };
}

function rows(value: unknown): AdminOrderRow[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: AdminOrderRow[] = [];
  for (const item of value) {
    const row = parseAdminOrderRow(item);
    if (row === null) return null;
    parsed.push(row);
  }
  return parsed;
}

export function parseAdminSummary(value: unknown): AdminSummary | null {
  if (!isRecord(value)) return null;
  if (!finite(value.newToday) || !finite(value.toVerify) || !finite(value.weekVerifiedSalesCents)) {
    return null;
  }
  const pending = rows(value.pending);
  const upcoming = rows(value.upcoming);
  if (pending === null || upcoming === null || !Array.isArray(value.lowStock)) return null;
  const lowStock: AdminSummary["lowStock"] = [];
  for (const item of value.lowStock) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string")
      return null;
    if (!finite(item.stock)) return null;
    lowStock.push({ id: item.id, name: item.name, stock: item.stock });
  }
  return {
    newToday: value.newToday,
    toVerify: value.toVerify,
    weekVerifiedSalesCents: value.weekVerifiedSalesCents,
    pending,
    upcoming,
    lowStock,
  };
}

export function parseOrderPage(value: unknown): Page<AdminOrderRow> | null {
  if (!isRecord(value)) return null;
  const items = rows(value.items);
  if (items === null) return null;
  if (value.nextCursor !== null && typeof value.nextCursor !== "string") return null;
  return { items, nextCursor: value.nextCursor };
}

export function isInvalidTransition(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  return value.error.code === "invalid_transition";
}
