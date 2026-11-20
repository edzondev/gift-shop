import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAdminOrder } from "../admin.functions";
import { OrderDetail } from "../components/order-detail";
import { SinAcceso } from "../components/sin-acceso";

export const Route = createFileRoute("/admin/pedidos/$code")({
  loader: async ({ params }) => {
    const result = await getAdminOrder({ data: params.code });
    if (result.kind === "missing") throw notFound();
    if (result.kind === "denied" && result.status === 401) throw redirect({ to: "/admin/login" });
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
  if (result.kind === "denied") return <SinAcceso status={result.status} />;
  if (result.kind !== "ok") return <OrderError />;
  return <OrderDetail loaded={result.order} />;
}
