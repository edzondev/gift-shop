import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin" }],
  }),
  component: AdminIndexPage,
});

function AdminIndexPage() {
  return <h1>Admin</h1>;
}
