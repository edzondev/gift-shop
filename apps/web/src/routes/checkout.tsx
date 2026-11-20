import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCart, useCartReady } from "../cart/store";
import { CheckoutForm } from "../checkout/form";
import checkoutCss from "../checkout.css?url";
import { getCheckoutContext } from "../checkout.functions";
import shopCss from "../shop.css?url";
import storeCss from "../store.css?url";

export const Route = createFileRoute("/checkout")({
  loader: () => getCheckoutContext(),
  head: () => ({
    meta: [{ title: "Checkout" }],
    links: [
      { rel: "stylesheet", href: storeCss },
      { rel: "stylesheet", href: shopCss },
      { rel: "stylesheet", href: checkoutCss },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const context = Route.useLoaderData();
  const ready = useCartReady();
  const lines = useCart();
  if (!ready) return <main className="shop checkout-page skeleton" aria-busy="true" />;
  if (lines.length === 0) return <Navigate to="/carrito" />;
  return (
    <main className="shop checkout-page">
      <div className="shop-wrap">
        <p className="shop-kicker">Solo unos datos más</p>
        <h1>Casi listo</h1>
        <CheckoutForm
          lines={lines}
          today={context.today}
          yapeNumber={context.yapeNumber}
          yapeName={context.yapeName}
        />
      </div>
    </main>
  );
}
