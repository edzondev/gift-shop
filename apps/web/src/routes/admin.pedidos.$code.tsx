import { createFileRoute, notFound } from "@tanstack/react-router";
import { getAdminOrder } from "../admin.functions";
import { OrderDetail } from "../components/order-detail";
import { SinAcceso } from "../components/sin-acceso";

export const Route = createFileRoute("/admin/pedidos/$code")({
  loader: async ({ params }) => {
    const result = await getAdminOrder({ data: params.code });
    if (result.kind === "missing") throw notFound();
    return result;
  },
  head: ({ params }) => ({
    meta: [{ title: params.code }],
  }),
  errorComponent: OrderError,
  component: OrderPage,
});

function OrderError() {
  return (
    <p role="alert" className="empty">
      No pudimos cargar el pedido. Inténtalo de nuevo.
    </p>
  );
}

function OrderPage() {
  const result = Route.useLoaderData();
  if (result.kind === "denied") return <SinAcceso />;
  if (result.kind !== "ok") return <OrderError />;
  return <OrderDetail loaded={result.order} />;
}
