import { createFileRoute } from "@tanstack/react-router";
import { receivePhoto } from "../product.functions";

export const Route = createFileRoute("/admin/productos/$id/foto")({
  server: {
    handlers: {
      POST: ({ request, params }) => receivePhoto(request, params.id),
    },
  },
});
