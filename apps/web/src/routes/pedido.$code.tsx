import { createFileRoute, notFound } from "@tanstack/react-router";
import { OrderView } from "../order/view";
import { getPublicOrder } from "../orders.functions";

type OrderSearch = { t: string };

const privateHeaders = {
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

export const Route = createFileRoute("/pedido/$code")({
  validateSearch: (search: Record<string, unknown>): OrderSearch => ({
    t: typeof search.t === "string" ? search.t : "",
  }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ params, deps }) => {
    const lookup = await getPublicOrder({ data: { code: params.code, token: deps.t } });
    if (!lookup.found) throw notFound();
    return lookup.order;
  },
  headers: () => privateHeaders,
  head: ({ params }) => ({
    meta: [{ title: params.code }, { name: "referrer", content: "no-referrer" }],
  }),
  component: OrderPage,
});

function OrderPage() {
  const order = Route.useLoaderData();
  return <OrderView order={order} />;
}
