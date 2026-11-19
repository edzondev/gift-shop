export function appendProducts<T>(
  current: { items: readonly T[]; nextCursor: string | null },
  requestCursor: string,
  page: { items: readonly T[]; nextCursor: string | null },
): { items: T[]; nextCursor: string | null } | null {
  if (current.nextCursor !== requestCursor) return null;
  return { items: [...current.items, ...page.items], nextCursor: page.nextCursor };
}
