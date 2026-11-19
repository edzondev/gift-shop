import type { CreateOrderInput } from "api";

type OrderItem = CreateOrderInput["items"][number];

export type GiftColor = NonNullable<OrderItem["color"]>;
export type GiftSize = OrderItem["size"];
