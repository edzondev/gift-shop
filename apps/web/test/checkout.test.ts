import { expect, it } from "vitest";
import { type CheckoutDraft, emptyDelivery, parseCheckout } from "../src/checkout/schema";

const item = { productId: "p05", qty: 1, size: "clasica" as const };

function draft(patch: Partial<CheckoutDraft> = {}): CheckoutDraft {
  return {
    name: "Lucía Ramos",
    phone: "987654321",
    email: "",
    delivery: { mode: "estacion", station: "San Carlos", slot: "tarde" },
    deliveryDate: "2026-11-22",
    note: "",
    yapeOperation: "08452317",
    ...patch,
  };
}

it("trims text, accepts accents, emoji and multiline, and rejects empty or lettered operation", () => {
  const ok = parseCheckout(
    draft({
      name: "  María Ñoño 🌷  ",
      phone: "987 654 321",
      email: "  ana@example.com  ",
      note: "  Es sorpresa.\nNo llamar.  ",
      delivery: {
        mode: "delivery",
        address: "  Av. Próceres 1520\nDpto. 4  ",
        district: "  San Juan de Lurigancho  ",
        reference: "  Portón verde 💛  ",
      },
    }),
    [{ ...item, card: { message: "Feliz cumple,\nhermana 💛" } }],
    9400,
    "2026-11-22",
  );
  expect(ok.ok).toBe(true);
  if (!ok.ok) return;
  expect(ok.value.customer.name).toBe("María Ñoño 🌷");
  expect(ok.value.customer.phone).toBe("987654321");
  expect(ok.value.customer.email).toBe("ana@example.com");
  expect(ok.value.note).toBe("Es sorpresa.\nNo llamar.");
  if (ok.value.delivery.mode !== "delivery") throw new Error("expected delivery");
  expect(ok.value.delivery.address).toBe("Av. Próceres 1520\nDpto. 4");
  expect(ok.value.delivery.reference).toBe("Portón verde 💛");

  const empty = parseCheckout(
    draft({ name: "   ", phone: "   ", note: "   ", yapeOperation: "" }),
    [item],
    100,
    "2026-11-22",
  );
  expect(empty.ok).toBe(false);
  if (empty.ok) return;
  expect(empty.fields.name).toBeTruthy();
  expect(empty.fields.phone).toBeTruthy();
  expect(empty.fields.yapeOperation).toBeTruthy();

  const letters = parseCheckout(draft({ yapeOperation: "12ab5678" }), [item], 100, "2026-11-22");
  expect(letters.ok).toBe(false);
  if (letters.ok) return;
  expect(letters.fields.yapeOperation).toBeTruthy();

  const longName = parseCheckout(draft({ name: "a".repeat(81) }), [item], 100, "2026-11-22");
  expect(longName.ok).toBe(false);
});

it("blocks a date before the minimum and drops the other delivery mode", () => {
  const early = parseCheckout(draft({ deliveryDate: "2026-11-21" }), [item], 100, "2026-11-22");
  expect(early.ok).toBe(false);
  if (early.ok) return;
  expect(early.fields.deliveryDate).toBeTruthy();

  const home = emptyDelivery("delivery");
  expect(home.mode).toBe("delivery");
  expect("station" in home).toBe(false);
  expect("slot" in home).toBe(false);
  const station = emptyDelivery("estacion");
  expect(station.mode).toBe("estacion");
  expect("address" in station).toBe(false);
});
