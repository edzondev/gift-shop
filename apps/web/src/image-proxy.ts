import { encodedImageKey } from "./image-key";

const RESPONSE_HEADERS = ["content-type", "cache-control", "etag"] as const;

export type ImageFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function forwardedHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

export async function proxyProductImage(
  key: string,
  ifNoneMatch: string | null,
  fetchImage: ImageFetch,
): Promise<Response> {
  const encoded = encodedImageKey(key);
  if (encoded === null) return new Response(null, { status: 404 });

  const headers = new Headers();
  if (ifNoneMatch !== null) headers.set("If-None-Match", ifNoneMatch);
  const upstream = await fetchImage(`http://api/images/${encoded}`, { method: "GET", headers });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: forwardedHeaders(upstream),
  });
}
