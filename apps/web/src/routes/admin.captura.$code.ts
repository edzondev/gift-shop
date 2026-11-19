import { createFileRoute } from "@tanstack/react-router";
import { serveCapture } from "../admin.functions";

export const Route = createFileRoute("/admin/captura/$code")({
  server: {
    handlers: {
      GET: ({ request, params }) => serveCapture(request, params.code),
    },
  },
});
