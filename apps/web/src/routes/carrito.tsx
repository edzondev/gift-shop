import { createFileRoute } from "@tanstack/react-router";
import { CartView } from "../cart/view";
import cartCss from "../cart.css?url";
import shopCss from "../shop.css?url";
import storeCss from "../store.css?url";

export const Route = createFileRoute("/carrito")({
  head: () => ({
    meta: [{ title: "Carrito" }],
    links: [
      { rel: "stylesheet", href: storeCss },
      { rel: "stylesheet", href: shopCss },
      { rel: "stylesheet", href: cartCss },
    ],
  }),
  component: CartView,
});
