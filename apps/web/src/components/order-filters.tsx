import { Link, useNavigate } from "@tanstack/react-router";
import type { OrderStatus } from "api";
import { ORDER_STATUSES, statusLabel } from "../admin-action";
import type { OrdersSearch } from "../admin-search";

const FILTERS: readonly { status?: OrderStatus; label: string }[] = [
  { label: "Todos" },
  ...ORDER_STATUSES.map((status) => ({ status, label: statusLabel(status) })),
];

function searchFor(search: OrdersSearch, status: OrderStatus | undefined): OrdersSearch {
  const next: OrdersSearch = {};
  if (status !== undefined) next.status = status;
  if (search.q !== undefined) next.q = search.q;
  return next;
}

function fieldValue(target: unknown): string {
  if (typeof target !== "object" || target === null || !("value" in target)) return "";
  return typeof target.value === "string" ? target.value : "";
}

export function OrderFilters({ search }: { search: OrdersSearch }) {
  const navigate = useNavigate();
  return (
    <div className="stack">
      <div className="list-head">
        <h1>Pedidos</h1>
        <label className="search">
          <span className="sr-only">Buscar cliente o pedido</span>
          <input
            type="search"
            name="q"
            value={search.q ?? ""}
            placeholder="Buscar cliente o pedido"
            onChange={(event) => {
              const q = fieldValue(event.target);
              const next: OrdersSearch = {};
              if (search.status !== undefined) next.status = search.status;
              if (q !== "") next.q = q;
              void navigate({ to: "/admin/pedidos", search: next });
            }}
          />
        </label>
      </div>
      <fieldset className="filters">
        <legend className="sr-only">Estado del pedido</legend>
        {FILTERS.map((filter) => {
          const current = search.status === filter.status;
          return (
            <Link
              key={filter.label}
              to="/admin/pedidos"
              search={searchFor(search, filter.status)}
              className="chip"
              aria-current={current ? "page" : undefined}
            >
              {filter.label}
            </Link>
          );
        })}
      </fieldset>
    </div>
  );
}
