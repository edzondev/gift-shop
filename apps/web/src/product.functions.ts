import { createMiddleware, createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseStatus } from "@tanstack/react-start/server";
import * as v from "valibot";
import { adminClient } from "./admin-api";
import { readSessionToken } from "./admin-session";
import { readJsonLimited } from "./limited-json";
import {
  createProduct,
  patchProduct,
  postStock,
  readProductById,
  readProducts,
} from "./product-api";
import { photoNotice } from "./product-errors";
import { changedInput, inputFromProduct, parseDraft } from "./product-form";
import { openPhoto, PHOTO_BYTES, photoMeta } from "./product-photo";
import { isRecord } from "./record";

const directCall = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const followed = await next();
  if (
    ("result" in followed && followed.result !== undefined) ||
    !("kind" in followed) ||
    typeof followed.kind !== "string"
  ) {
    return followed;
  }
  const view: Record<string, unknown> = { kind: followed.kind };
  if ("status" in followed) view.status = followed.status;
  if ("page" in followed) view.page = followed.page;
  if ("product" in followed) view.product = followed.product;
  if ("fields" in followed) view.fields = followed.fields;
  return { ...followed, result: view };
});

function sessionToken(): string | undefined {
  return readSessionToken(getRequestHeader("cookie") ?? null);
}

function publish<T extends { kind: string; status?: number }>(view: T): T {
  if (view.kind === "denied" && (view.status === 401 || view.status === 403)) {
    setResponseStatus(view.status);
  }
  return view;
}

const listSchema = v.object({
  cursor: v.optional(v.pipe(v.string(), v.minLength(1))),
});

export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([directCall])
  .validator((input: unknown) => {
    const parsed = v.safeParse(listSchema, input ?? {});
    return parsed.success ? parsed.output : {};
  })
  .handler(async ({ data }) => {
    return publish(await readProducts(sessionToken(), data.cursor));
  });

export const getAdminProduct = createServerFn({ method: "GET" })
  .middleware([directCall])
  .validator((input: unknown) => (typeof input === "string" ? input : ""))
  .handler(async ({ data }) => {
    if (data === "") return { kind: "missing" as const };
    return publish(await readProductById(sessionToken(), data));
  });

export const createAdminProduct = createServerFn({ method: "POST" })
  .middleware([directCall])
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const parsed = parseDraft(data, "create");
    if (!parsed.ok) return publish({ kind: "invalid" as const, fields: parsed.fields });
    return publish(await createProduct(sessionToken(), parsed.value));
  });

export const saveAdminProduct = createServerFn({ method: "POST" })
  .middleware([directCall])
  .validator((input: unknown) => {
    if (!isRecord(input) || typeof input.id !== "string" || input.id.length === 0) return null;
    return { id: input.id, draft: input.draft };
  })
  .handler(async ({ data }) => {
    if (data === null) {
      return publish({ kind: "invalid" as const, fields: { form: "No pudimos leer el cambio." } });
    }
    const parsed = parseDraft(data.draft, "edit");
    if (!parsed.ok) return publish({ kind: "invalid" as const, fields: parsed.fields });
    const token = sessionToken();
    const current = await readProductById(token, data.id);
    if (current.kind === "denied" || current.kind === "missing") return publish(current);
    if (current.kind !== "ok") return publish({ kind: "failed" as const });
    const patch = changedInput(inputFromProduct(current.product), parsed.value);
    if (patch === null) return publish({ kind: "unchanged" as const, product: current.product });
    return publish(await patchProduct(token, data.id, patch));
  });

const activeSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  active: v.boolean(),
});

export const setProductActive = createServerFn({ method: "POST" })
  .middleware([directCall])
  .validator((input: unknown) => {
    const parsed = v.safeParse(activeSchema, input);
    return parsed.success ? parsed.output : null;
  })
  .handler(async ({ data }) => {
    if (data === null) return publish({ kind: "failed" as const });
    return publish(await patchProduct(sessionToken(), data.id, { active: data.active }));
  });

const stockSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  delta: v.picklist([-1, 1, 5]),
});

export const adjustAdminStock = createServerFn({ method: "POST" })
  .middleware([directCall])
  .validator((input: unknown) => {
    const parsed = v.safeParse(stockSchema, input);
    return parsed.success ? parsed.output : null;
  })
  .handler(async ({ data }) => {
    if (data === null) return publish({ kind: "failed" as const });
    return publish(await postStock(sessionToken(), data.id, data.delta));
  });

const REPLY_LIMIT = 65_536;

function photoError(status: 413 | 415): Response {
  const code = status === 413 ? "file_too_large" : "unsupported_file_type";
  return Response.json(
    { error: { code, message: photoNotice(code) ?? "" } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

async function passUpstream(upstream: {
  status: number;
  body: ReadableStream | null;
}): Promise<Response> {
  if (upstream.status === 204) {
    await upstream.body?.cancel();
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
  const body = await readJsonLimited(upstream.body, REPLY_LIMIT);
  const payload = body ?? { error: { code: "internal_error", message: "Empty response" } };
  return Response.json(payload, {
    status: upstream.status,
    headers: { "cache-control": "no-store" },
  });
}

async function readCapped(
  stream: ReadableStream<Uint8Array>,
  max: number,
): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export const receivePhoto = createServerOnlyFn(async (request: Request, id: string) => {
  const token = readSessionToken(request.headers.get("cookie"));
  const opened = await openPhoto(request);
  if (!opened.ok) return photoError(opened.status);
  const bytes = await readCapped(opened.stream, PHOTO_BYTES);
  if (bytes === null) return photoError(413);
  const meta = photoMeta(opened.kind);
  const form = new FormData();
  form.append("photo", new File([bytes], meta.filename, { type: meta.type }));
  const upstream = await adminClient(token).admin.products[":id"].photos.$post(
    { param: { id } },
    { init: { body: form } },
  );
  return passUpstream(upstream);
});

export const removePhoto = createServerOnlyFn(
  async (request: Request, id: string, photoId: string) => {
    const token = readSessionToken(request.headers.get("cookie"));
    const upstream = await adminClient(token).admin.products[":id"].photos[":photoId"].$delete({
      param: { id, photoId },
    });
    return passUpstream(upstream);
  },
);
