import { Navigate } from "@tanstack/react-router";

export function SinAcceso({ status }: { status?: 401 | 403 }) {
  if (status === 401) return <Navigate to="/admin/login" />;
  return (
    <main className="denied">
      <h1>Sin acceso</h1>
      <p>No pudimos confirmar tu acceso al panel.</p>
    </main>
  );
}
