import type { PublicOrder } from "api";
import { expect, it, vi } from "vitest";
import { giftCount, progressStep, rejectedOrder, thanksLead } from "../src/order/copy";
import { renderPath } from "./render-path";

const base = {
  code: "REG-2026-0001",
  createdAt: "2026-11-20T12:00:00.000Z",
  delivery: { mode: "estacion", station: "Bayóvar", slot: "tarde" },
  deliveryDate: "2026-11-25",
  items: [
    {
      productName: "Piñata de corazón 🎁 para un nombre larguísimo",
      qty: 2,
      options: ["Clásica", "Terracota"],
      cardMessage: "Feliz día\nÑandú 🌷",
      lineTotalCents: 17800,
    },
  ],
  subtotalCents: 17800,
  deliveryCostCents: 0,
  yapeOperation: "08452317",
} satisfies Omit<PublicOrder, "status" | "verifiedAt" | "deliveredAt" | "rejectedAt">;

function reviewing(): PublicOrder {
  return { ...base, status: "por_verificar" };
}

function confirmed(): PublicOrder {
  return { ...base, status: "confirmado", verifiedAt: "2026-11-20T15:00:00.000Z" };
}

function rejected(): PublicOrder {
  return { ...base, status: "rechazado", rejectedAt: "2026-11-20T15:00:00.000Z" };
}

vi.mock("../src/orders.functions", () => {
  function record(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  return {
    getPublicOrder: (input: unknown) => {
      const data = record(input) && record(input.data) ? input.data : null;
      const code = data !== null && typeof data.code === "string" ? data.code : "";
      if (code === "rechazado") return Promise.resolve({ found: true, order: rejected() });
      if (code === "confirmado") return Promise.resolve({ found: true, order: confirmed() });
      if (code === "revision") return Promise.resolve({ found: true, order: reviewing() });
      return Promise.resolve({ found: false });
    },
    placeOrder: () => Promise.resolve({ ok: false, message: "no" }),
  };
});

it("names each order state with its own sentence", () => {
  expect(thanksLead("por_verificar")).toBe("está en revisión.");
  expect(thanksLead("confirmado")).toBe("está confirmado.");
  expect(thanksLead("en_preparacion")).toBe("se está preparando.");
  expect(thanksLead("listo")).toBe("está listo.");
  expect(thanksLead("entregado")).toBe("ya fue entregado.");
  expect(thanksLead("rechazado")).toBe("no pudo confirmarse.");
  expect(rejectedOrder("rechazado")).toBe(true);
  expect(rejectedOrder("listo")).toBe(false);
  expect(progressStep("rechazado")).toBe(0);
  expect(progressStep("listo")).toBe(3);
  expect(giftCount(1)).toBe("1 regalo");
  expect(giftCount(2)).toBe("2 regalos");
});

it("shows the rejected order outside the progress line", async () => {
  const page = await renderPath("/pedido/rechazado?t=token");
  expect(page.status).toBe(200);
  expect(page.html).toContain("¡Gracias!");
  expect(page.html).toContain("Estado de tu pedido");
  expect(page.html).toContain('data-rejected="true"');
  expect(page.html).toContain("order-rejected");
  expect(page.html).toContain("Rechazado");
  expect(page.html).not.toContain("timeline-current");
  expect(page.html).toContain("Feliz día");
  expect(page.html).toContain("Ñandú 🌷");
});

it("marks the current contract step", async () => {
  const page = await renderPath("/pedido/confirmado?t=token");
  expect(page.status).toBe(200);
  expect(page.html).toContain('data-rejected="false"');
  expect(page.html).toContain('data-step="1"');
  expect(page.html).toContain("timeline-current");
  expect(page.html).toContain("timeline-done");
  expect(page.html).toContain("está confirmado.");
  const reviewingPage = await renderPath("/pedido/revision?t=token");
  expect(reviewingPage.html).toContain('data-step="0"');
  expect(reviewingPage.html).toContain("timeline-current");
});
