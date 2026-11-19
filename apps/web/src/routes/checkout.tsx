import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCart, useCartReady } from "../cart/store";
import { CheckoutForm } from "../checkout/form";
import { getCheckoutContext } from "../checkout.functions";

export const Route = createFileRoute("/checkout")({
  loader: () => getCheckoutContext(),
  head: () => ({
    meta: [{ title: "Checkout" }],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const context = Route.useLoaderData();
  const ready = useCartReady();
  const lines = useCart();
  if (!ready) return <main className="sheet skeleton" aria-busy="true" />;
  if (lines.length === 0) return <Navigate to="/carrito" />;
  return (
    <main className="sheet">
      <p className="kicker">Solo unos datos más</p>
      <h1>Casi listo</h1>
      <CheckoutForm
        lines={lines}
        today={context.today}
        yapeNumber={context.yapeNumber}
        yapeName={context.yapeName}
      />
    </main>
  );
}
