import type { InferOutput } from "valibot";
import type { createOrderInputSchema, deliverySchema } from "./orders/schemas";
import type { fieldSchema, occasionSchema } from "./products/schemas";

export type Occasion = InferOutput<typeof occasionSchema>;
export type Field = InferOutput<typeof fieldSchema>;

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

export type ProductCard = {
  slug: string;
  name: string;
  priceCents: number;
  oldPriceCents: number | null;
  tag: string | null;
  occasions: Occasion[];
  prepDays: number;
  photoKeys: string[];
  customizable: boolean;
  stockLeft: number | null;
};

export type ProductDetail = ProductCard & {
  id: string;
  description: string;
  fields: Field[];
  sizes: { classic: string; large: string; largeExtraCents: number };
  inStock: boolean;
};

export type Delivery = InferOutput<typeof deliverySchema>;
export type CreateOrderInput = InferOutput<typeof createOrderInputSchema>;

export type CreatedOrder = {
  code: string;
  token: string;
  status: "por_verificar";
  totalCents: number;
};

export type OrderLine = {
  productName: string;
  qty: number;
  options: string[];
  cardMessage: string | null;
  lineTotalCents: number;
};

type PublicOrderBase = {
  code: string;
  createdAt: string;
  delivery: Delivery;
  deliveryDate: string;
  items: OrderLine[];
  subtotalCents: number;
  deliveryCostCents: number | null;
  yapeOperation: string;
};

type OrderState =
  | { status: "por_verificar" }
  | { status: "confirmado"; verifiedAt: string }
  | { status: "en_preparacion"; verifiedAt: string }
  | { status: "listo"; verifiedAt: string }
  | { status: "entregado"; verifiedAt: string; deliveredAt: string }
  | { status: "rechazado"; rejectedAt: string };

export type PublicOrder = PublicOrderBase & OrderState;

export type OrderStatus = PublicOrder["status"];

export type AdminOrderRow = OrderState & {
  code: string;
  customerName: string;
  itemsShort: string;
  delivery: Delivery;
  deliveryDate: string;
  totalCents: number;
  createdAt: string;
};

export type AdminOrder = PublicOrder & {
  customer: { name: string; phone: string; email: string | null };
  note: string | null;
};

export type AdminSummary = {
  newToday: number;
  toVerify: number;
  weekVerifiedSalesCents: number;
  pending: AdminOrderRow[];
  upcoming: AdminOrderRow[];
  lowStock: { id: string; name: string; stock: number }[];
};
