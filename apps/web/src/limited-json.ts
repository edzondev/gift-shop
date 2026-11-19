export async function readJsonLimited(body: ReadableStream | null, max: number): Promise<unknown> {
  if (body === null) return null;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    if (!(next.value instanceof Uint8Array)) {
      await reader.cancel();
      return null;
    }
    total += next.value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(next.value);
  }
  if (total === 0) return null;
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(merged));
  } catch {
    return null;
  }
}
