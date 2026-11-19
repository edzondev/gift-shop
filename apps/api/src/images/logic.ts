import * as v from "valibot";

const MAX_KEY_LENGTH = 200;

const imageKeySchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(MAX_KEY_LENGTH),
  v.check((key) => !key.includes("..")),
);

export type ServedImage =
  | { kind: "missing" }
  | { kind: "not_modified"; etag: string }
  | { kind: "ok"; etag: string; contentType: string | undefined; body: ReadableStream };

function readKey(rawKey: string): string | null {
  let key: string;
  try {
    key = decodeURIComponent(rawKey);
  } catch (error) {
    if (error instanceof URIError) return null;
    throw error;
  }
  const parsed = v.safeParse(imageKeySchema, key);
  if (!parsed.success) return null;
  return parsed.output;
}

async function photoListed(db: D1Database, key: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS ok FROM product_photos WHERE r2_key = ? AND r2_key NOT LIKE 'captures/%'")
    .bind(key)
    .first();
  return row !== null;
}

function contentType(object: R2ObjectBody): string | undefined {
  const value = object.httpMetadata?.contentType;
  if (value === undefined || value.includes("\n") || value.includes("\r")) return undefined;
  return value;
}

function hasBody(object: R2Object | R2ObjectBody): object is R2ObjectBody {
  return "body" in object;
}

function conditionalEtag(ifNoneMatch: string | undefined): string | undefined {
  if (ifNoneMatch === undefined) return undefined;
  const value = ifNoneMatch.trim();
  if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) return undefined;
  const token = value.slice(1, -1);
  if (token.length === 0 || token.includes('"')) return undefined;
  return token;
}

async function loadObject(
  bucket: R2Bucket,
  key: string,
  ifNoneMatch: string | undefined,
): Promise<R2Object | R2ObjectBody | null> {
  const etag = conditionalEtag(ifNoneMatch);
  if (etag === undefined) return bucket.get(key);
  return bucket.get(key, { onlyIf: { etagDoesNotMatch: etag } });
}

export async function serveImage(
  db: D1Database,
  bucket: R2Bucket,
  rawKey: string,
  ifNoneMatch: string | undefined,
): Promise<ServedImage> {
  const key = readKey(rawKey);
  if (key === null) return { kind: "missing" };
  if (!(await photoListed(db, key))) return { kind: "missing" };

  const object = await loadObject(bucket, key, ifNoneMatch);
  if (object === null) return { kind: "missing" };
  if (!hasBody(object)) return { kind: "not_modified", etag: object.httpEtag };
  return {
    kind: "ok",
    etag: object.httpEtag,
    contentType: contentType(object),
    body: object.body,
  };
}
