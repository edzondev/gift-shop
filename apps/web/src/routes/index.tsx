import { createFileRoute } from "@tanstack/react-router";
import { shelfFromDirectCall } from "../featured-shelf";
import { HomeDelivery } from "../home/delivery";
import { HomeFeatured } from "../home/featured";
import { HomeHero } from "../home/hero";
import { HomeMaker } from "../home/maker";
import { HomeMarquee } from "../home/marquee";
import { HomeSteps } from "../home/steps";
import homeCss from "../home.css?url";
import { listFeatured } from "../home.functions";

export const Route = createFileRoute("/")({
  loader: () => listFeatured(),
  head: () => ({
    meta: [{ title: "Inicio" }],
    links: [{ rel: "stylesheet", href: homeCss }],
  }),
  component: HomePage,
});

function HomePage() {
  const shelf = shelfFromDirectCall(Route.useLoaderData()) ?? { kind: "unavailable" };
  return (
    <main className="home">
      <HomeHero shelf={shelf} />
      <HomeMarquee />
      <HomeFeatured shelf={shelf} />
      <HomeSteps />
      <HomeMaker />
      <HomeDelivery />
    </main>
  );
}
