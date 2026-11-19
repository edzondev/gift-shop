import type { AdminProduct, ProductInput } from "api";
import { expect, it } from "vitest";
import {
  changedInput,
  draftFromProduct,
  emptyDraft,
  firstField,
  type ProductDraft,
  parseDraft,
} from "../src/product-form";

const saved = {
  id: "p1",
  slug: "caja-sorpresa",
  name: "Caja sorpresa",
  priceCents: 1250,
  oldPriceCents: 2000,
  tag: "Nuevo",
  occasions: ["cumple"],
  prepDays: 2,
  photoKeys: ["foto-1"],
  customizable: true,
  stockLeft: 1,
  description: "Hecha a mano\ncon tildes",
  fields: ["nombre", "color"],
  sizes: { classic: "Clásica", large: "Grande", largeExtraCents: 500 },
  inStock: true,
  stock: 1,
  active: true,
  photos: [{ id: "ph1", key: "foto-1" }],
} satisfies AdminProduct;

function draft(overrides: Partial<ProductDraft> = {}): ProductDraft {
  return { ...draftFromProduct(saved), ...overrides };
}

function inputOf(value: ProductDraft, mode: "create" | "edit" = "edit"): ProductInput {
  const parsed = parseDraft(value, mode);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.fields));
  return parsed.value;
}

it("trims names, keeps accents, emoji, and description lines", () => {
  const name = `  ${"Regalo ".repeat(40)}ñandú 🎁  `;
  const parsed = parseDraft(
    draft({ name, description: "  Primera línea\nSegunda ✨  ", slug: "regalo-nandu" }),
    "edit",
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.fields));
  expect(parsed.value.name).toBe(name.trim());
  expect(parsed.value.description).toBe("Primera línea\nSegunda ✨");
});

it("rejects an empty name and an empty description", () => {
  const emptyName = parseDraft(draft({ name: "   " }), "edit");
  const emptyDescription = parseDraft(draft({ description: " \n " }), "edit");
  if (emptyName.ok || emptyDescription.ok) throw new Error("expected invalid drafts");
  expect(emptyName.fields.name).toBeTruthy();
  expect(emptyDescription.fields.description).toBeTruthy();
  expect(firstField(emptyName.fields)).toBe("name");
});

it("rejects a slug with uppercase or spaces", () => {
  for (const slug of ["Caja", "caja sorpresa", "Caja-Sorpresa"]) {
    const parsed = parseDraft(draft({ slug }), "edit");
    if (parsed.ok) throw new Error(slug);
    expect(parsed.fields.slug, slug).toMatch(/minúsculas/i);
  }
});

it("reads prices with a comma or a dot and rejects the bad ones", () => {
  const comma = parseDraft(draft({ price: "12,50", oldPrice: "20" }), "edit");
  const dot = parseDraft(draft({ price: "12.5", oldPrice: "" }), "edit");
  if (!comma.ok || !dot.ok) throw new Error("expected prices");
  expect(comma.value.priceCents).toBe(1250);
  expect(dot.value.priceCents).toBe(1250);
  expect(dot.value.oldPriceCents).toBeNull();

  for (const price of ["", "0", "-1", "12.501"]) {
    const parsed = parseDraft(draft({ price }), "edit");
    if (parsed.ok) throw new Error(price);
    expect(parsed.fields.price, price).toBeTruthy();
  }
});

it("rejects an old price that is not above the price", () => {
  const equal = parseDraft(draft({ price: "12,50", oldPrice: "12.50" }), "edit");
  const lower = parseDraft(draft({ price: "12,50", oldPrice: "10" }), "edit");
  const higher = parseDraft(draft({ price: "12,50", oldPrice: "12,51" }), "edit");
  if (equal.ok || lower.ok || !higher.ok) throw new Error("old price comparison");
  expect(equal.fields.oldPrice).toMatch(/mayor/);
  expect(lower.fields.oldPrice).toMatch(/mayor/);
  expect(higher.value.oldPriceCents).toBe(1251);
});

it("sends initial stock only when creating a product", () => {
  const created = parseDraft(draft({ initialStock: "4" }), "create");
  const edited = parseDraft(draft({ initialStock: "4" }), "edit");
  const blank = parseDraft(draft({ initialStock: "  " }), "create");
  if (!created.ok || !edited.ok || !blank.ok) throw new Error("stock parse");
  expect(created.value.initialStock).toBe(4);
  expect(edited.value.initialStock).toBeUndefined();
  expect(blank.value.initialStock).toBeUndefined();
  const negative = parseDraft(draft({ initialStock: "-1" }), "create");
  if (negative.ok) throw new Error("negative stock");
  expect(negative.fields.initialStock).toBeTruthy();
});

it("patches only the fields that changed", () => {
  const before = inputOf(draft());
  const priceOnly = changedInput(before, inputOf(draft({ price: "15" })));
  expect(priceOnly).toEqual({ priceCents: 1500 });

  const hidden = changedInput(before, inputOf(draft({ active: false })));
  expect(hidden).toEqual({ active: false });

  const sizes = changedInput(before, inputOf(draft({ large: "Familiar" })));
  expect(sizes).toEqual({
    sizes: { classic: "Clásica", large: "Familiar", largeExtraCents: 500 },
  });

  const fields = changedInput(before, inputOf(draft({ fields: ["nombre"] })));
  expect(fields).toEqual({ fields: ["nombre"] });

  expect(changedInput(before, inputOf(draft()))).toBeNull();
});

it("rejects an unknown server payload with the form schema", () => {
  const slug = parseDraft({ ...draft(), slug: "Caja Sorpresa" }, "edit");
  if (slug.ok) throw new Error("slug");
  expect(slug.fields.slug).toBeTruthy();
  const empty = parseDraft(null, "create");
  expect(empty.ok).toBe(false);
  expect(emptyDraft().active).toBe(true);
});
