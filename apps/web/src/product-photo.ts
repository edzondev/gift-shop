export const PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_LIMIT = 3;

export type PhotoKind = "jpeg" | "png" | "webp";
export type PhotoRef = { id: string; key: string };

const JPEG = [0xff, 0xd8, 0xff] as const;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (bytes[index] !== prefix[index]) return false;
  }
  return true;
}

export function photoKind(head: Uint8Array): PhotoKind | null {
  if (hasPrefix(head, JPEG)) return "jpeg";
  if (hasPrefix(head, PNG)) return "png";
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export function photoIssue(
  size: number,
  head: Uint8Array,
): "file_too_large" | "unsupported_file_type" | null {
  if (!Number.isSafeInteger(size) || size < 0 || size > PHOTO_BYTES) return "file_too_large";
  if (size < 12 || photoKind(head) === null) return "unsupported_file_type";
  return null;
}

export function canUpload(count: number): boolean {
  return count < PHOTO_LIMIT;
}

export function photosAfterCreate(
  current: readonly PhotoRef[],
  photo: PhotoRef,
): readonly PhotoRef[] {
  if (!canUpload(current.length)) return current;
  return [...current, photo];
}

export function photosAfterDelete(current: readonly PhotoRef[], id: string): readonly PhotoRef[] {
  return current.filter((photo) => photo.id !== id);
}

export function photosAfterReject(current: readonly PhotoRef[]): readonly PhotoRef[] {
  return current;
}

export function declaredSize(header: string | null): number | null {
  if (header === null || !/^\d+$/.test(header)) return null;
  const size = Number(header);
  if (!Number.isSafeInteger(size)) return null;
  return size;
}

function once(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      if (bytes.byteLength > 0) controller.enqueue(bytes);
      controller.close();
    },
  });
}

export function chainStreams(
  streams: readonly ReadableStream<Uint8Array>[],
): ReadableStream<Uint8Array> {
  let index = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  return new ReadableStream({
    async pull(controller) {
      for (;;) {
        if (reader === null) {
          const next = streams[index];
          if (next === undefined) {
            controller.close();
            return;
          }
          reader = next.getReader();
          index += 1;
        }
        const chunk = await reader.read();
        if (chunk.done) {
          reader = null;
          continue;
        }
        controller.enqueue(chunk.value);
        return;
      }
    },
    cancel(reason) {
      const pending = reader?.cancel(reason);
      return pending ?? Promise.resolve();
    },
  });
}

function limitBytes(source: ReadableStream<Uint8Array>, max: number): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let left = max;
  return new ReadableStream({
    async pull(controller) {
      if (left <= 0) {
        controller.close();
        await reader.cancel();
        return;
      }
      const next = await reader.read();
      if (next.done) {
        controller.close();
        return;
      }
      if (next.value.byteLength <= left) {
        left -= next.value.byteLength;
        controller.enqueue(next.value);
        return;
      }
      controller.enqueue(next.value.subarray(0, left));
      left = 0;
      await reader.cancel();
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

async function takeHead(
  body: ReadableStream<Uint8Array>,
  count: number,
): Promise<{
  head: Uint8Array;
  rest: ReadableStream<Uint8Array>;
  cancel: () => Promise<void>;
} | null> {
  const reader = body.getReader();
  const head = new Uint8Array(count);
  let filled = 0;
  let pending: Uint8Array | null = null;
  while (filled < count) {
    const next = await reader.read();
    if (next.done) {
      await reader.cancel();
      return null;
    }
    const need = count - filled;
    if (next.value.byteLength <= need) {
      head.set(next.value, filled);
      filled += next.value.byteLength;
      continue;
    }
    head.set(next.value.subarray(0, need), filled);
    pending = next.value.subarray(need);
    filled = count;
  }
  const rest = new ReadableStream<Uint8Array>({
    start(controller) {
      if (pending !== null && pending.byteLength > 0) controller.enqueue(pending);
    },
    async pull(controller) {
      const next = await reader.read();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(next.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return { head, rest, cancel: () => reader.cancel().then(() => undefined) };
}

export async function openPhoto(
  request: Request,
): Promise<
  | { ok: true; kind: PhotoKind; stream: ReadableStream<Uint8Array> }
  | { ok: false; status: 413 | 415 }
> {
  const size = declaredSize(request.headers.get("content-length"));
  if (size === null || size < 12) return { ok: false, status: 415 };
  if (size > PHOTO_BYTES) return { ok: false, status: 413 };
  const body = request.body;
  if (body === null) return { ok: false, status: 415 };
  const split = await takeHead(body, 12);
  if (split === null) return { ok: false, status: 415 };
  const kind = photoKind(split.head);
  if (kind === null) {
    await split.cancel();
    return { ok: false, status: 415 };
  }
  const file = chainStreams([once(split.head), split.rest]);
  return { ok: true, kind, stream: limitBytes(file, size) };
}

export function photoMeta(kind: PhotoKind): { type: string; filename: string } {
  switch (kind) {
    case "jpeg":
      return { type: "image/jpeg", filename: "foto.jpg" };
    case "png":
      return { type: "image/png", filename: "foto.png" };
    case "webp":
      return { type: "image/webp", filename: "foto.webp" };
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
