import { createFileRoute } from "@tanstack/react-router";
import { proxyProductImage } from "../image-proxy";

export const Route = createFileRoute("/img/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { env } = await import("cloudflare:workers");
        return proxyProductImage(
          params._splat ?? "",
          request.headers.get("If-None-Match"),
          (input, init) => env.API.fetch(input, init),
        );
      },
    },
  },
});
