import { Hono } from "hono";
import { type ApiEnv, imageNotFound } from "../errors";
import { serveImage } from "./logic";

const CACHE_CONTROL = "public, max-age=31536000, immutable";

export const images = new Hono<ApiEnv>().get("/*", async (c) => {
  const path = c.req.path;
  const rawKey = path.startsWith("/images/") ? path.slice("/images/".length) : "";
  const image = await serveImage(c.env.DB, c.env.FILES, rawKey, c.req.header("If-None-Match"));
  if (image.kind === "missing") return c.json(imageNotFound(), 404);

  const headers: Record<string, string> = {
    ETag: image.etag,
    "Cache-Control": CACHE_CONTROL,
  };
  if (image.kind === "not_modified") return c.body(null, 304, headers);
  if (image.contentType !== undefined) headers["Content-Type"] = image.contentType;
  return c.body(image.body, 200, headers);
});
