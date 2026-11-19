import type { CreateOrderInput } from "api";
import { createOrderInputSchema } from "api";
import * as v from "valibot";
import type { CartLine, ItemInput } from "../cart/logic";
import { isRealDate } from "../dates";
import { COLORS, SLOTS, STATIONS } from "../labels";

const sizes = ["clasica", "grande"] as const;

export type DeliveryDraft =
  | { mode: "estacion"; station: string; slot: string }
  | { mode: "delivery"; address: string; district: string; reference: string };

export type CheckoutDraft = {
  name: string;
  phone: string;
  email: string;
  delivery: DeliveryDraft;
  deliveryDate: string;
  note: string;
  yapeOperation: string;
};

export type CheckoutFields = Partial<
  Record<
    | "name"
    | "phone"
    | "email"
    | "station"
    | "slot"
    | "address"
    | "district"
    | "reference"
    | "deliveryDate"
    | "note"
    | "yapeOperation"
    | "items",
    string
  >
>;

const trim = (value: string) => value.trim();

const itemSchema = v.object({
  productId: v.pipe(v.string(), v.minLength(1, "Falta el producto")),
  qty: v.pipe(
    v.number("La cantidad no es válida"),
    v.integer("La cantidad no es válida"),
    v.minValue(1, "La cantidad no es válida"),
    v.maxValue(20, "La cantidad no es válida"),
  ),
  size: v.picklist(sizes, "El tamaño no es válido"),
  name: v.exactOptional(
    v.pipe(v.string(), v.minLength(1, "El nombre del regalo no es válido"), v.maxLength(14)),
  ),
  color: v.exactOptional(v.picklist(COLORS, "El color no es válido")),
  card: v.exactOptional(
    v.object({
      message: v.pipe(
        v.string(),
        v.minLength(1, "Escribe la dedicatoria"),
        v.maxLength(200, "La dedicatoria puede tener hasta 200 caracteres"),
      ),
    }),
  ),
  wrap: v.exactOptional(v.boolean()),
});

const customerSchema = v.object({
  name: v.pipe(
    v.string(),
    v.transform(trim),
    v.minLength(1, "Cuéntanos tu nombre"),
    v.maxLength(80, "El nombre es demasiado largo"),
  ),
  phone: v.pipe(
    v.string(),
    v.transform((value) => value.replaceAll(/\s+/g, "")),
    v.regex(/^\d{9}$/, "Ingresa un celular de 9 dígitos"),
  ),
  email: v.exactOptional(v.pipe(v.string(), v.transform(trim), v.email("El correo no es válido"))),
});

const estacionSchema = v.object({
  mode: v.literal("estacion"),
  station: v.picklist(STATIONS, "Elige una estación"),
  slot: v.picklist(SLOTS, "Elige un horario"),
});

const deliverySchema = v.object({
  mode: v.literal("delivery"),
  address: v.pipe(
    v.string(),
    v.transform(trim),
    v.minLength(1, "Necesitamos la dirección"),
    v.maxLength(200, "La dirección es demasiado larga"),
  ),
  district: v.pipe(
    v.string(),
    v.transform(trim),
    v.minLength(1, "Elige tu distrito"),
    v.maxLength(80, "El distrito es demasiado largo"),
  ),
  reference: v.exactOptional(
    v.pipe(
      v.string(),
      v.transform(trim),
      v.minLength(1),
      v.maxLength(200, "La referencia es demasiado larga"),
    ),
  ),
});

export const orderPayloadSchema = v.object({
  customer: customerSchema,
  delivery: v.variant("mode", [estacionSchema, deliverySchema]),
  deliveryDate: v.pipe(v.string(), v.check(isRealDate, "Elige una fecha válida")),
  note: v.exactOptional(
    v.pipe(
      v.string(),
      v.transform(trim),
      v.minLength(1),
      v.maxLength(500, "La nota puede tener hasta 500 caracteres"),
    ),
  ),
  items: v.pipe(
    v.array(itemSchema),
    v.minLength(1, "El carrito está vacío"),
    v.maxLength(20, "El carrito tiene demasiados regalos"),
  ),
  yapeOperation: v.pipe(
    v.string(),
    v.transform(trim),
    v.regex(/^\d{6,14}$/, "El número de operación debe tener de 6 a 14 dígitos"),
  ),
  expectedTotalCents: v.pipe(v.number(), v.integer(), v.minValue(0, "El total no es válido")),
});

export function emptyDelivery(mode: DeliveryDraft["mode"]): DeliveryDraft {
  if (mode === "estacion") return { mode: "estacion", station: "", slot: "" };
  return { mode: "delivery", address: "", district: "", reference: "" };
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function checkoutCandidate(
  draft: CheckoutDraft,
  items: readonly ItemInput[],
  expectedTotalCents: number,
): unknown {
  const email = optionalText(draft.email);
  const note = optionalText(draft.note);
  const customer = {
    name: draft.name,
    phone: draft.phone,
    ...(email !== undefined ? { email } : {}),
  };
  const delivery =
    draft.delivery.mode === "estacion"
      ? {
          mode: "estacion",
          station: draft.delivery.station,
          slot: draft.delivery.slot,
        }
      : {
          mode: "delivery",
          address: draft.delivery.address,
          district: draft.delivery.district,
          ...(optionalText(draft.delivery.reference) !== undefined
            ? { reference: optionalText(draft.delivery.reference) }
            : {}),
        };
  return {
    customer,
    delivery,
    deliveryDate: draft.deliveryDate.trim(),
    ...(note !== undefined ? { note } : {}),
    items,
    yapeOperation: draft.yapeOperation,
    expectedTotalCents,
  };
}

const FIELD_PATHS: Record<string, keyof CheckoutFields> = {
  "customer.name": "name",
  "customer.phone": "phone",
  "customer.email": "email",
  "delivery.station": "station",
  "delivery.slot": "slot",
  "delivery.address": "address",
  "delivery.district": "district",
  "delivery.reference": "reference",
  deliveryDate: "deliveryDate",
  note: "note",
  yapeOperation: "yapeOperation",
  items: "items",
};

export function parseCheckout(
  draft: CheckoutDraft,
  items: readonly ItemInput[],
  expectedTotalCents: number,
  minDate: string,
): { ok: true; value: CreateOrderInput } | { ok: false; fields: CheckoutFields } {
  const parsed = v.safeParse(
    orderPayloadSchema,
    checkoutCandidate(draft, items, expectedTotalCents),
  );
  const fields: CheckoutFields = {};
  if (!parsed.success) {
    for (const issue of parsed.issues) {
      const path = (issue.path ?? []).map((item) => String(item.key)).join(".");
      const field = FIELD_PATHS[path] ?? (path.startsWith("items") ? "items" : undefined);
      if (field !== undefined && fields[field] === undefined) fields[field] = issue.message;
    }
  }
  const date = draft.deliveryDate.trim();
  if (isRealDate(date) && date < minDate && fields.deliveryDate === undefined) {
    fields.deliveryDate = "Esa fecha es muy pronto";
  }
  if (!parsed.success || fields.deliveryDate !== undefined) return { ok: false, fields };
  if (parsed.output.deliveryDate < minDate) {
    return { ok: false, fields: { ...fields, deliveryDate: "Esa fecha es muy pronto" } };
  }
  const typed = v.safeParse(createOrderInputSchema, parsed.output);
  if (!typed.success) return { ok: false, fields: { items: "Revisa los datos del pedido" } };
  return { ok: true, value: typed.output };
}

export function itemsFromLines(lines: readonly CartLine[]): ItemInput[] {
  return lines.map((line) => {
    const item: ItemInput = {
      productId: line.productId,
      qty: line.qty,
      size: line.size,
    };
    if (line.name !== undefined) item.name = line.name;
    if (line.color !== undefined) item.color = line.color;
    if (line.card !== undefined) item.card = line.card;
    if (line.wrap === true) item.wrap = true;
    return item;
  });
}
