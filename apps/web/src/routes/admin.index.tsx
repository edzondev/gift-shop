import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { AdminSummaryView } from "../components/admin-summary";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Resumen" }],
  }),
  component: AdminIndexPage,
});

function AdminIndexPage() {
  const result = useLoaderData({ from: "/admin" });
  if (result.kind !== "ok") return null;
  return <AdminSummaryView summary={result.summary} todayLabel={result.todayLabel} />;
}
