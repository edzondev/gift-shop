export type Attempt = {
  key: string;
  fingerprint: string;
};

export function attemptKey(
  previous: Attempt | null,
  fingerprint: string,
  create: () => string,
): Attempt {
  if (previous !== null && previous.fingerprint === fingerprint) return previous;
  return { key: create(), fingerprint };
}

export function claimSubmit(state: { current: boolean }): boolean {
  if (state.current) return false;
  state.current = true;
  return true;
}

export function markCleared(state: { current: boolean }): boolean {
  if (state.current) return false;
  state.current = true;
  return true;
}

export function orderFingerprint(
  order: unknown,
  file: { name: string; size: number; lastModified: number; type: string },
): string {
  return JSON.stringify({
    order,
    file: {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      type: file.type,
    },
  });
}
