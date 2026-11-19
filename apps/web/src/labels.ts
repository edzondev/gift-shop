import type { OrderStatus } from "api";

export const STATIONS = [
  "Bayóvar",
  "Santa Rosa",
  "San Martín",
  "San Carlos",
  "Los Postes",
  "Los Jardines",
  "Pirámide del Sol",
  "Caja de Agua",
] as const;

export const SLOTS = ["manana", "tarde", "noche"] as const;

export const COLORS = ["terracota", "oliva", "mostaza", "rosa_palo", "crudo"] as const;

export const ORDER_STATUSES = [
  "por_verificar",
  "confirmado",
  "en_preparacion",
  "listo",
  "entregado",
  "rechazado",
] as const satisfies readonly OrderStatus[];

export const FIELDS = ["nombre", "color", "tamano", "tarjeta", "envoltura"] as const;

export const OCCASIONS = ["cumple", "aniversario", "sanvalentin", "mama", "bebe"] as const;

export type Station = (typeof STATIONS)[number];
export type Slot = (typeof SLOTS)[number];
export type Color = (typeof COLORS)[number];
export type { OrderStatus };
export type Field = (typeof FIELDS)[number];
export type Occasion = (typeof OCCASIONS)[number];

export function stationLabel(station: Station): string {
  switch (station) {
    case "Bayóvar":
      return "Bayóvar";
    case "Santa Rosa":
      return "Santa Rosa";
    case "San Martín":
      return "San Martín";
    case "San Carlos":
      return "San Carlos";
    case "Los Postes":
      return "Los Postes";
    case "Los Jardines":
      return "Los Jardines";
    case "Pirámide del Sol":
      return "Pirámide del Sol";
    case "Caja de Agua":
      return "Caja de Agua";
    default: {
      const neverStation: never = station;
      return neverStation;
    }
  }
}

export function slotLabel(slot: Slot): string {
  switch (slot) {
    case "manana":
      return "Mañana · 9–12";
    case "tarde":
      return "Tarde · 2–6";
    case "noche":
      return "Noche · 6–8";
    default: {
      const neverSlot: never = slot;
      return neverSlot;
    }
  }
}

export function colorLabel(color: Color): string {
  switch (color) {
    case "terracota":
      return "Terracota";
    case "oliva":
      return "Oliva";
    case "mostaza":
      return "Mostaza";
    case "rosa_palo":
      return "Rosa palo";
    case "crudo":
      return "Crudo";
    default: {
      const neverColor: never = color;
      return neverColor;
    }
  }
}

export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "por_verificar":
      return "Pago en revisión";
    case "confirmado":
      return "Confirmado";
    case "en_preparacion":
      return "En preparación";
    case "listo":
      return "Listo";
    case "entregado":
      return "Entregado";
    case "rechazado":
      return "Rechazado";
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export function statusDetail(status: OrderStatus): string {
  switch (status) {
    case "por_verificar":
      return "Verificamos tu Yape";
    case "confirmado":
      return "Ya confirmamos el pago";
    case "en_preparacion":
      return "Lo hago a mano";
    case "listo":
      return "Envuelto y con tu tarjeta";
    case "entregado":
      return "¡Que lo disfruten!";
    case "rechazado":
      return "No pudimos confirmar el pago";
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export const TIMELINE = [
  "por_verificar",
  "confirmado",
  "en_preparacion",
  "listo",
  "entregado",
] as const satisfies readonly OrderStatus[];

export function timelineIndex(status: OrderStatus): number {
  switch (status) {
    case "por_verificar":
      return 0;
    case "confirmado":
      return 1;
    case "en_preparacion":
      return 2;
    case "listo":
      return 3;
    case "entregado":
      return 4;
    case "rechazado":
      return -1;
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}
