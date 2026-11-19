import { createFileRoute } from "@tanstack/react-router";
import { CartView } from "../cart/view";

export const Route = createFileRoute("/carrito")({
  head: () => ({
    meta: [{ title: "Carrito" }],
  }),
  component: CartView,
});
