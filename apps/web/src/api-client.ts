import { env } from "cloudflare:workers";
import type { AppType } from "api";
import { hc } from "hono/client";

export function apiClient() {
  return hc<AppType>("http://api", {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => env.API.fetch(input, init),
  });
}
