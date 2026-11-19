import type { AdminProduct, Field, Occasion, ProductInput } from "api";
import * as v from "valibot";
import { type FieldMessages, PRODUCT_FIELDS, type ProductField } from "./product-errors";
import { centsLabel, solesToCents } from "./product-money";
import { isRecord } from "./record";

const NAME_EMPTY = "Escribe el nombre.";
const DESCRIPTION_EMPTY = "Escribe la descripción.";
const SLUG_MSG = "Usa minúsculas, números y guiones, sin espacios.";
const PRICE_FORMAT = "Escribe el precio en soles, por ejemplo 12,50.";
const PRICE_POSITIVE = "El precio tiene que ser mayor que cero.";
const OLD_FORMAT = "Escribe el precio anterior en soles, o déjalo vacío.";
const OLD_ORDER = "El precio anterior tiene que ser mayor que el precio.";
const PREP_MSG = "Los días de preparación van de 0 a 30.";
const SIZE_MSG = "Escribe el nombre del tamaño.";
const EXTRA_MSG = "El recargo de Grande tiene que ser mayor que cero.";
const STOCK_MSG = "El stock inicial es un entero de 0 a 999.";
const FIELD_MSG = "Ese campo de personalización no existe.";
const OCCASION_MSG = "Esa ocasión no existe.";

const FIELD_IDS = [
  "nombre",
  "color",
  "tamano",
  "tarjeta",
  "envoltura",
] as const satisfies readonly Field[];
const OCCASION_IDS = [
  "cumple",
  "aniversario",
  "sanvalentin",
  "mama",
  "bebe",
] as const satisfies readonly Occasion[];

export const FIELD_ORDER = PRODUCT_FIELDS;

export type ProductDraft = {
  name: string;
  slug: string;
  price: string;
  oldPrice: string;
  prepDays: string;
  description: string;
  occasions: Occasion[];
  tag: string;
  classic: string;
  large: string;
  largeExtra: string;
  fields: Field[];
  active: boolean;
  initialStock: string;
};

export type ProductPatch = Partial<Omit<ProductInput, "initialStock">>;

export type DraftResult = { ok: true; value: ProductInput } | { ok: false; fields: FieldMessages };

const requiredText = (message: string) => v.pipe(v.string(), v.trim(), v.minLength(1, message));

const slugSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(80, SLUG_MSG),
  v.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, SLUG_MSG),
);

const priceSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((value) => solesToCents(value) !== null, PRICE_FORMAT),
  v.check((value) => {
    const cents = solesToCents(value);
    return cents !== null && cents >= 1;
  }, PRICE_POSITIVE),
  v.transform((value) => solesToCents(value) ?? 0),
);

const oldPriceSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((value) => value === "" || solesToCents(value) !== null, OLD_FORMAT),
  v.check((value) => {
    if (value === "") return true;
    const cents = solesToCents(value);
    return cents !== null && cents >= 1;
  }, OLD_FORMAT),
  v.transform((value) => (value === "" ? null : (solesToCents(value) ?? null))),
);

const prepSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^(?:0|[1-9]|[12]\d|30)$/, PREP_MSG),
  v.transform((value) => Number(value)),
);

const stockSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((value) => value === "" || /^(?:0|[1-9]\d{0,2})$/.test(value), STOCK_MSG),
  v.transform((value): number | undefined => (value === "" ? undefined : Number(value))),
);

const draftSchema = v.pipe(
  v.object({
    mode: v.picklist(["create", "edit"]),
    name: requiredText(NAME_EMPTY),
    slug: slugSchema,
    price: priceSchema,
    oldPrice: oldPriceSchema,
    prepDays: prepSchema,
    description: requiredText(DESCRIPTION_EMPTY),
    occasions: v.array(v.picklist(OCCASION_IDS, OCCASION_MSG)),
    tag: v.pipe(
      v.string(),
      v.trim(),
      v.transform((value) => (value === "" ? null : value)),
    ),
    classic: requiredText(SIZE_MSG),
    large: requiredText(SIZE_MSG),
    largeExtra: v.pipe(
      v.string(),
      v.trim(),
      v.check((value) => solesToCents(value) !== null, EXTRA_MSG),
      v.check((value) => {
        const cents = solesToCents(value);
        return cents !== null && cents >= 1;
      }, EXTRA_MSG),
      v.transform((value) => solesToCents(value) ?? 0),
    ),
    fields: v.array(v.picklist(FIELD_IDS, FIELD_MSG)),
    active: v.boolean(),
    initialStock: stockSchema,
  }),
  v.forward(
    v.partialCheck(
      [["price"], ["oldPrice"]],
      (input) => input.oldPrice === null || input.oldPrice > input.price,
      OLD_ORDER,
    ),
    ["oldPrice"],
  ),
);

function issuePath(issue: v.BaseIssue<unknown>): string {
  const keys: string[] = [];
  for (const item of issue.path ?? []) {
    if (typeof item.key === "string" || typeof item.key === "number") keys.push(String(item.key));
  }
  return keys.join(".");
}

function formField(path: string): ProductField | null {
  const key = path.split(".")[0] ?? "";
  switch (key) {
    case "name":
    case "slug":
    case "price":
    case "oldPrice":
    case "prepDays":
    case "description":
    case "occasions":
    case "tag":
    case "classic":
    case "large":
    case "largeExtra":
    case "fields":
    case "active":
    case "initialStock":
      return key;
    default:
      return null;
  }
}

function fieldsFromIssues(issues: readonly v.BaseIssue<unknown>[]): FieldMessages {
  const fields: FieldMessages = {};
  for (const issue of issues) {
    const field = formField(issuePath(issue));
    const message = issue.message;
    if (field === null) {
      if (fields.form === undefined) fields.form = message;
      continue;
    }
    if (fields[field] === undefined) fields[field] = message;
  }
  return fields;
}

function toInput(value: v.InferOutput<typeof draftSchema>): ProductInput {
  const input = {
    slug: value.slug,
    name: value.name,
    priceCents: value.price,
    oldPriceCents: value.oldPrice,
    prepDays: value.prepDays,
    description: value.description,
    fields: [...value.fields],
    occasions: [...value.occasions],
    tag: value.tag,
    sizes: {
      classic: value.classic,
      large: value.large,
      largeExtraCents: value.largeExtra,
    },
    active: value.active,
  };
  if (value.mode === "edit" || value.initialStock === undefined) return input;
  return { ...input, initialStock: value.initialStock };
}

export function emptyDraft(): ProductDraft {
  return {
    name: "",
    slug: "",
    price: "",
    oldPrice: "",
    prepDays: "",
    description: "",
    occasions: [],
    tag: "",
    classic: "",
    large: "",
    largeExtra: "",
    fields: [],
    active: true,
    initialStock: "",
  };
}

export function draftFromProduct(product: AdminProduct): ProductDraft {
  return {
    name: product.name,
    slug: product.slug,
    price: centsLabel(product.priceCents),
    oldPrice: product.oldPriceCents === null ? "" : centsLabel(product.oldPriceCents),
    prepDays: String(product.prepDays),
    description: product.description,
    occasions: [...product.occasions],
    tag: product.tag ?? "",
    classic: product.sizes.classic,
    large: product.sizes.large,
    largeExtra: centsLabel(product.sizes.largeExtraCents),
    fields: [...product.fields],
    active: product.active,
    initialStock: "",
  };
}

export function inputFromProduct(product: AdminProduct): ProductInput {
  return {
    slug: product.slug,
    name: product.name,
    priceCents: product.priceCents,
    oldPriceCents: product.oldPriceCents,
    prepDays: product.prepDays,
    description: product.description,
    fields: [...product.fields],
    occasions: [...product.occasions],
    tag: product.tag,
    sizes: {
      classic: product.sizes.classic,
      large: product.sizes.large,
      largeExtraCents: product.sizes.largeExtraCents,
    },
    active: product.active,
  };
}

export function parseDraft(input: unknown, mode: "create" | "edit"): DraftResult {
  const parsed = v.safeParse(draftSchema, isRecord(input) ? { ...input, mode } : { mode });
  if (!parsed.success) return { ok: false, fields: fieldsFromIssues(parsed.issues) };
  return { ok: true, value: toInput(parsed.output) };
}

function sameItems<T>(left: readonly T[], right: readonly T[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

export function changedInput(before: ProductInput, after: ProductInput): ProductPatch | null {
  const patch: ProductPatch = {};
  if (before.slug !== after.slug) patch.slug = after.slug;
  if (before.name !== after.name) patch.name = after.name;
  if (before.priceCents !== after.priceCents) patch.priceCents = after.priceCents;
  if (before.oldPriceCents !== after.oldPriceCents) patch.oldPriceCents = after.oldPriceCents;
  if (before.prepDays !== after.prepDays) patch.prepDays = after.prepDays;
  if (before.description !== after.description) patch.description = after.description;
  if (!sameItems(before.fields, after.fields)) patch.fields = [...after.fields];
  if (!sameItems(before.occasions, after.occasions)) patch.occasions = [...after.occasions];
  if (before.tag !== after.tag) patch.tag = after.tag;
  if (
    before.sizes.classic !== after.sizes.classic ||
    before.sizes.large !== after.sizes.large ||
    before.sizes.largeExtraCents !== after.sizes.largeExtraCents
  ) {
    patch.sizes = {
      classic: after.sizes.classic,
      large: after.sizes.large,
      largeExtraCents: after.sizes.largeExtraCents,
    };
  }
  if (before.active !== after.active) patch.active = after.active;
  if (Object.keys(patch).length === 0) return null;
  return patch;
}

export function firstField(fields: FieldMessages): ProductField | null {
  for (const field of FIELD_ORDER) {
    if (fields[field] !== undefined) return field;
  }
  return null;
}

export function toggleMember<T extends string>(items: readonly T[], item: T): T[] {
  if (items.includes(item)) return items.filter((current) => current !== item);
  return [...items, item];
}
