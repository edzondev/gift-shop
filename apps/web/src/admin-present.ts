import type { Delivery, OrderStatus } from "api";

const SLOTS = {
  manana: "Mañana · 9–12",
  tarde: "Tarde · 2–6",
  noche: "Noche · 6–8",
} as const satisfies Record<Extract<Delivery, { mode: "estacion" }>["slot"], string>;

export function slotLabel(slot: Extract<Delivery, { mode: "estacion" }>["slot"]): string {
  switch (slot) {
    case "manana":
    case "tarde":
    case "noche":
      return SLOTS[slot];
    default: {
      const exhaustive: never = slot;
      return exhaustive;
    }
  }
}

export function deliveryPlace(delivery: Delivery): string {
  switch (delivery.mode) {
    case "estacion":
      return `Estación ${delivery.station} · ${slotLabel(delivery.slot)}`;
    case "delivery": {
      const place = `${delivery.address}, ${delivery.district}`;
      return delivery.reference === undefined ? place : `${place} · ${delivery.reference}`;
    }
    default: {
      const exhaustive: never = delivery;
      return exhaustive;
    }
  }
}

export function nameInitial(name: string): string {
  const first = new Intl.Segmenter("es", { granularity: "grapheme" })
    .segment(name)
    [Symbol.iterator]()
    .next().value;
  if (first === undefined || first.segment.trim() === "") return "?";
  return first.segment.toLocaleUpperCase("es-PE");
}

function titled(date: Date, options: Intl.DateTimeFormatOptions): string {
  const formatted = new Intl.DateTimeFormat("es-PE", options).format(date);
  const first = new Intl.Segmenter("es", { granularity: "grapheme" })
    .segment(formatted)
    [Symbol.iterator]()
    .next().value;
  if (first === undefined) return formatted;
  return first.segment.toLocaleUpperCase("es-PE") + formatted.slice(first.segment.length);
}

export function limaTodayLabel(now: Date): string {
  return titled(now, {
    timeZone: "America/Lima",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function utcDay(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

export function deliveryLong(date: string): string {
  const utc = utcDay(date);
  if (utc === null) return date;
  return titled(utc, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export function deliveryShort(date: string): { dow: string; day: string; label: string } {
  const utc = utcDay(date);
  if (utc === null) return { dow: "", day: "", label: date };
  const dow = titled(utc, { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return {
    dow,
    day: String(utc.getUTCDate()),
    label: titled(utc, { day: "numeric", month: "short", timeZone: "UTC" }),
  };
}

export function whenInLima(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return titled(date, {
    timeZone: "America/Lima",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function phoneHref(phone: string): string | null {
  if (!/^\d{9}$/.test(phone)) return null;
  return `https://wa.me/51${phone}`;
}

export function statusClass(status: OrderStatus): string {
  switch (status) {
    case "por_verificar":
      return "st-por_verificar";
    case "confirmado":
      return "st-confirmado";
    case "en_preparacion":
      return "st-en_preparacion";
    case "listo":
      return "st-listo";
    case "entregado":
      return "st-entregado";
    case "rechazado":
      return "st-rechazado";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function orderTotalCents(order: {
  subtotalCents: number;
  deliveryCostCents: number | null;
}): number {
  return order.subtotalCents + (order.deliveryCostCents ?? 0);
}
