import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/producto/$slug")({
  head: ({ params }) => ({
    meta: [{ title: params.slug }],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  return <h1>{slug}</h1>;
}
