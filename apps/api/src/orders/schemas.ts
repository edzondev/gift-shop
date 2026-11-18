import * as v from "valibot";

const QTY = "qty must be an integer from 1 to 20";
const ITEMS = "items must contain 1 to 20 products";
const NAME = "name must be 1 to 14 characters";
const MESSAGE = "message must be 1 to 200 characters";
const CENTS = "expectedTotalCents must be a non-negative integer";

export const colorSchema = v.picklist(
  ["terracota", "oliva", "mostaza", "rosa_palo", "crudo"],
  "unknown color",
);

const stationSchema = v.picklist(
  [
    "Bayóvar",
    "Santa Rosa",
    "San Martín",
    "San Carlos",
    "Los Postes",
    "Los Jardines",
    "Pirámide del Sol",
    "Caja de Agua",
  ],
  "unknown station",
);

const slotSchema = v.picklist(["manana", "tarde", "noche"], "unknown slot");

function nonEmpty(message: string) {
  return v.pipe(
    v.string(),
    v.check((value) => value.trim().length > 0, message),
  );
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const itemSchema = v.object({
  productId: v.pipe(v.string(), v.minLength(1, "productId is required")),
  qty: v.pipe(v.number(QTY), v.integer(QTY), v.minValue(1, QTY), v.maxValue(20, QTY)),
  size: v.picklist(["clasica", "grande"], "size must be clasica or grande"),
  name: v.optional(v.pipe(v.string(), v.minLength(1, NAME), v.maxLength(14, NAME))),
  color: v.optional(colorSchema),
  card: v.optional(
    v.object({
      message: v.pipe(v.string(), v.minLength(1, MESSAGE), v.maxLength(200, MESSAGE)),
    }),
  ),
  wrap: v.optional(v.boolean()),
});

const estacionSchema = v.object({
  mode: v.literal("estacion"),
  station: stationSchema,
  slot: slotSchema,
});

const homeSchema = v.object({
  mode: v.literal("delivery"),
  address: nonEmpty("address must not be empty"),
  district: nonEmpty("district must not be empty"),
  reference: v.optional(v.string()),
});

export const deliverySchema = v.variant(
  "mode",
  [estacionSchema, homeSchema],
  "delivery is invalid",
);

export const createOrderInputSchema = v.object({
  customer: v.object({
    name: v.pipe(v.string(), v.minLength(1, "name must not be empty")),
    phone: v.pipe(v.string(), v.regex(/^\d{9}$/, "phone must be 9 digits")),
    email: v.optional(v.pipe(v.string(), v.email("email is invalid"))),
  }),
  delivery: deliverySchema,
  deliveryDate: v.pipe(
    v.string(),
    v.check(isRealDate, "deliveryDate must be a real yyyy-MM-dd date"),
  ),
  note: v.optional(v.pipe(v.string(), v.maxLength(500, "note must be at most 500 characters"))),
  items: v.pipe(v.array(itemSchema, ITEMS), v.minLength(1, ITEMS), v.maxLength(20, ITEMS)),
  yapeOperation: v.pipe(v.string(), v.regex(/^\d{6,14}$/, "yapeOperation must be 6 to 14 digits")),
  expectedTotalCents: v.pipe(v.number(CENTS), v.integer(CENTS), v.minValue(0, CENTS)),
});

function isJsonObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const orderTextSchema = v.pipe(
  v.string(),
  v.parseJson(undefined, "order must be JSON"),
  v.check(isJsonObject, "order must be an object"),
  createOrderInputSchema,
);

export const idempotencyHeaderSchema = v.object(
  {
    "idempotency-key": v.pipe(
      v.string("Idempotency-Key is required"),
      v.uuid("Idempotency-Key must be a UUID"),
    ),
  },
  "Idempotency-Key is required",
);

export const storedOptionsSchema = v.object({
  size: v.picklist(["clasica", "grande"]),
  name: v.optional(v.string()),
  color: v.optional(colorSchema),
  card: v.optional(v.object({ message: v.string() })),
  wrap: v.optional(v.boolean()),
});
