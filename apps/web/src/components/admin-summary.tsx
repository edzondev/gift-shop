import { Link } from "@tanstack/react-router";
import type { AdminSummary } from "api";
import { deliveryPlace, deliveryShort, nameInitial } from "../admin-present";
import { formatSoles } from "../money";
import { LowStock } from "./low-stock";
import { StatusBadge } from "./status-badge";

export function AdminSummaryView({
  summary,
  todayLabel,
}: {
  summary: AdminSummary;
  todayLabel: string;
}) {
  const pending = summary.pending.slice(0, 5);
  const upcoming = summary.upcoming.slice(0, 3);
  const lowNames = summary.lowStock.map((item) => item.name).join(", ");
  return (
    <div className="stack">
      <header className="summary-head">
        <div>
          <p className="today">{todayLabel}</p>
          <h1>Buenos días</h1>
          <p className="kicker">
            {summary.toVerify === 1
              ? "Tienes 1 pago esperando tu revisión"
              : `Tienes ${summary.toVerify} pagos esperando tu revisión`}
          </p>
        </div>
        <Link to="/admin/pedidos" className="btn">
          Ir a pedidos
        </Link>
      </header>
      <div className="stat-grid">
        <Link to="/admin/pedidos" className="stat">
          <span>Pedidos nuevos hoy</span>
          <strong className="stat-value">{summary.newToday}</strong>
        </Link>
        <Link to="/admin/pedidos" search={{ status: "por_verificar" }} className="stat stat-verify">
          <span>Pagos por verificar</span>
          <strong className="stat-value">{summary.toVerify}</strong>
        </Link>
        <div className="stat stat-stock">
          <span>Stock bajo</span>
          <strong className="stat-value">{summary.lowStock.length}</strong>
          <span className="stat-note">{lowNames === "" ? "Todo en orden" : lowNames}</span>
        </div>
        <div className="stat stat-sales">
          <span>Ventas de la semana</span>
          <span className="stat-kicker">verificadas</span>
          <strong className="stat-value stat-money">
            {formatSoles(summary.weekVerifiedSalesCents)}
          </strong>
        </div>
      </div>
      <div className="summary-columns">
        <section className="panel">
          <div className="panel-head">
            <h2>Por verificar</h2>
            <Link to="/admin/pedidos" search={{ status: "por_verificar" }}>
              Ver todos
            </Link>
          </div>
          {pending.length === 0 ? <p className="ok-note">¡Todo verificado!</p> : null}
          <ul className="plain">
            {pending.map((order) => (
              <li key={order.code} className="pending-row">
                <span className="avatar" aria-hidden="true">
                  {nameInitial(order.customerName)}
                </span>
                <span className="pending-who">
                  <b className="clamp">{order.customerName}</b>
                  <span className="clamp muted">
                    {order.code} · {order.itemsShort}
                  </span>
                </span>
                <b>{formatSoles(order.totalCents)}</b>
                <Link
                  to="/admin/pedidos/$code"
                  params={{ code: order.code }}
                  className="btn btn-small"
                >
                  Verificar
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <div className="stack">
          <section className="panel">
            <h2>Próximas entregas</h2>
            {upcoming.length === 0 ? <p className="muted">No hay entregas próximas.</p> : null}
            <ul className="plain">
              {upcoming.map((order) => {
                const day = deliveryShort(order.deliveryDate);
                return (
                  <li key={order.code}>
                    <Link
                      to="/admin/pedidos/$code"
                      params={{ code: order.code }}
                      className="upcoming"
                    >
                      <span className="daybox">
                        <span>{day.dow}</span>
                        <strong>{day.day}</strong>
                      </span>
                      <span className="pending-who">
                        <b className="clamp">{order.customerName}</b>
                        <span className="clamp muted">{deliveryPlace(order.delivery)}</span>
                      </span>
                      <StatusBadge status={order.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="panel">
            <h2>Stock bajo</h2>
            <LowStock items={summary.lowStock} />
          </section>
        </div>
      </div>
    </div>
  );
}
