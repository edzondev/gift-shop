import type { Occasion, ProductCard } from "api";

export type CatalogSlice = {
  occasion: Occasion | undefined;
  items: readonly ProductCard[];
  nextCursor: string | null;
};

export function catalogPageState(
  first: { items: readonly ProductCard[]; nextCursor: string | null },
  occasion: Occasion | undefined,
  extra: CatalogSlice | null,
): CatalogSlice {
  if (extra === null || extra.occasion !== occasion) {
    return { occasion, items: first.items, nextCursor: first.nextCursor };
  }
  return extra;
}

export function mergeNextPage(
  current: CatalogSlice,
  request: { occasion: Occasion | undefined; cursor: string },
  page: { items: readonly ProductCard[]; nextCursor: string | null },
): CatalogSlice | null {
  if (current.occasion !== request.occasion) return null;
  if (current.nextCursor !== request.cursor) return null;
  return {
    occasion: current.occasion,
    items: [...current.items, ...page.items],
    nextCursor: page.nextCursor,
  };
}

export function cursorToLoad(input: {
  loading: boolean;
  nextCursor: string | null;
}): string | null {
  if (input.loading) return null;
  return input.nextCursor;
}
