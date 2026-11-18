import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$")({
  head: () => ({
    meta: [{ title: "404" }],
  }),
  component: NotFoundPage,
});

function NotFoundPage() {
  return <h1>404</h1>;
}
