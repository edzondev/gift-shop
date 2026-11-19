import { createFileRoute } from "@tanstack/react-router";
import { removePhoto } from "../product.functions";

export const Route = createFileRoute("/admin/productos/$id/foto/$photoId")({
  server: {
    handlers: {
      DELETE: ({ request, params }) => removePhoto(request, params.id, params.photoId),
    },
  },
});
