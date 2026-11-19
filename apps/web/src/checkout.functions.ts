import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { limaToday } from "./dates";

export const getCheckoutContext = createServerFn({ method: "GET" }).handler(async () => {
  return {
    today: limaToday(new Date()),
    yapeNumber: env.YAPE_NUMBER,
    yapeName: env.YAPE_NAME,
  };
});
