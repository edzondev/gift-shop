import { createFileRoute, Outlet } from "@tanstack/react-router";
import adminCss from "../admin.css?url";
import { getAdminSummary } from "../admin.functions";
import { AdminShell } from "../components/admin-shell";
import { SinAcceso } from "../components/sin-acceso";

export const Route = createFileRoute("/admin")({
  loader: () => getAdminSummary(),
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
  if (result.kind === "denied") return <SinAcceso />;
  if (result.kind !== "ok") return <AdminError />;
  return (
    <AdminShell toVerify={result.summary.toVerify}>
      <Outlet />
    </AdminShell>
  );
}
