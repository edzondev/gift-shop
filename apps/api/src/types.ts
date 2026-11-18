import type { InferOutput } from "valibot";
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
