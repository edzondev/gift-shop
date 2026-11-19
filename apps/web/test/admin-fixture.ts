import type { AdminOrder, AdminOrderRow, AdminSummary } from "api";

export const row = {
  code: "REG-2026-0012",
  customerName: "Lucía Ramos",
  itemsShort: "Caja ×1",
  delivery: { mode: "estacion", station: "Bayóvar", slot: "manana" },
  deliveryDate: "2026-11-20",
  totalCents: 8900,
  createdAt: "2026-11-19T15:24:00.000Z",
  status: "por_verificar",
} satisfies AdminOrderRow;

export const order = {
  code: row.code,
  createdAt: row.createdAt,
  delivery: row.delivery,
  deliveryDate: row.deliveryDate,
  items: [
    {
      productName: "Caja",
      qty: 1,
      options: ["Grande"],
      cardMessage: "Feliz día",
      lineTotalCents: 8900,
    },
  ],
  subtotalCents: 8900,
  deliveryCostCents: null,
  yapeOperation: "123456",
  customer: { name: row.customerName, phone: "987654321", email: null },
  note: "Línea uno\nLínea dos",
  status: "por_verificar",
} satisfies AdminOrder;

export const summary = {
  newToday: 2,
  toVerify: 1,
  weekVerifiedSalesCents: 15000,
  pending: [row],
  upcoming: [],
  lowStock: [{ id: "ramo", name: "Ramo eterno", stock: 1 }],
} satisfies AdminSummary;

export function confirmedOrder(): AdminOrder {
  return { ...order, status: "confirmado", verifiedAt: "2026-11-19T16:00:00.000Z" };
}
