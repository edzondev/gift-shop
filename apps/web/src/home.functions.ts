import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { readFeatured } from "./featured";
import { shelfFromDirectCall } from "./featured-shelf";

const directCall = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const followed = await next();
  if ("result" in followed && followed.result !== undefined) return followed;
  const shelf = shelfFromDirectCall(followed);
  if (shelf === null) return followed;
  return { ...followed, result: shelf };
});

export const listFeatured = createServerFn({ method: "GET" })
  .middleware([directCall])
  .handler(() => readFeatured());
