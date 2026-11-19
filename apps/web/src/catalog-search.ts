import type { Occasion } from "api";
import * as v from "valibot";
import { OCCASION_IDS } from "./occasions";
import { isRecord } from "./record";

const occasionSchema = v.picklist(OCCASION_IDS);

export type CatalogSearch = {
  occasion: Occasion | undefined;
};

export type CatalogQuery = CatalogSearch & {
  cursor?: string;
};

export function catalogSearch(search: Record<string, unknown>): CatalogSearch {
  const parsed = v.safeParse(occasionSchema, search.occasion);
  if (!parsed.success) return { occasion: undefined };
  return { occasion: parsed.output };
}

export function catalogInput(input: unknown): CatalogQuery {
  const record = isRecord(input) ? input : {};
  const search = catalogSearch(record);
  const cursor = v.safeParse(v.optional(v.pipe(v.string(), v.minLength(1))), record.cursor);
  const query: CatalogQuery = { occasion: search.occasion };
  if (cursor.success && cursor.output !== undefined) query.cursor = cursor.output;
  return query;
}
