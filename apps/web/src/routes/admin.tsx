import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import adminCss from "../admin.css?url";
import { getAdminSummary } from "../admin.functions";
import { adminSession } from "../admin-session.functions";
import { AdminShell } from "../components/admin-shell";
import { SinAcceso } from "../components/sin-acceso";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const session = await adminSession();
    if (session.kind === "missing") throw redirect({ to: "/admin/login" });
  },
  loader: async () => {
    const summary = await getAdminSummary();
    if (summary.kind === "denied" && summary.status === 401) throw redirect({ to: "/admin/login" });
    return summary;
  },
  head: () => ({
    links: [{ rel: "stylesheet", href: adminCss }],
  }),
  errorComponent: AdminError,
  component: AdminLayout,
});

function AdminError() {
  return (
    <p role="alert" className="empty">
      No pudimos cargar el panel. Inténtalo de nuevo.
    </p>
  );
}

function AdminLayout() {
  const result = Route.useLoaderData();
  if (result.kind === "denied") return <SinAcceso status={result.status} />;
  if (result.kind !== "ok") return <AdminError />;
  return (
    <AdminShell toVerify={result.summary.toVerify}>
      <Outlet />
    </AdminShell>
  );
}
