import { createFileRoute, redirect } from "@tanstack/react-router";
import { listAdminOrders } from "../admin.functions";
import { ordersRequest, ordersSearch } from "../admin-search";
import { OrderFilters } from "../components/order-filters";
import { OrderList } from "../components/order-list";
import { SinAcceso } from "../components/sin-acceso";

export const Route = createFileRoute("/admin/pedidos/")({
  validateSearch: (search: Record<string, unknown>) => ordersSearch(search),
  loaderDeps: ({ search }) => ordersRequest(search),
  loader: async ({ deps }) => {
    const orders = await listAdminOrders({ data: deps });
    if (orders.kind === "denied" && orders.status === 401) throw redirect({ to: "/admin/login" });
    return orders;
  },
  head: () => ({
    meta: [{ title: "Pedidos" }],
  }),
  errorComponent: OrdersError,
  component: OrdersPage,
});

function OrdersError() {
  return (
    <p role="alert" className="empty">
      No pudimos cargar los pedidos. Inténtalo de nuevo.
    </p>
  );
}

function OrdersPage() {
  const search = Route.useSearch();
  const result = Route.useLoaderData();
  if (result.kind === "denied") return <SinAcceso status={result.status} />;
  if (result.kind !== "ok") return <OrdersError />;
  return (
    <div className="stack">
      <OrderFilters search={search} />
      <OrderList first={result.page} query={ordersRequest(search)} />
    </div>
  );
}
