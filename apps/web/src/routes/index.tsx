import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Inicio" }],
  }),
  component: HomePage,
});

function HomePage() {
  return <h1>Inicio</h1>;
}
