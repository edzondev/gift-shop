import type { ProductCard } from "api";
import { beforeEach, expect, it } from "vitest";
import {
  pageFromResponse,
  productFromResponse,
  readCatalog,
  readProduct,
} from "../src/catalog-api";
import { resetApiFetch, setApiFetch } from "./cloudflare-workers-stub";

const card = {
  slug: "ramo-pinata",
  name: "Piñata",
  priceCents: 8900,
  oldPriceCents: null,
  tag: null,
  occasions: ["cumple"],
  prepDays: 2,
  photoKeys: [],
  customizable: false,
  stockLeft: null,
} satisfies ProductCard;

function requestOf(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? input : new Request(input, init);
}

beforeEach(() => {
  resetApiFetch();
});

it("reads the status of an empty 404 before the body", async () => {
  const lookup = await productFromResponse(new Response("", { status: 404 }));
  expect(lookup.kind).toBe("missing");
});

it("retries a catalog 422 without reading that body", async () => {
  const page = await pageFromResponse(new Response("", { status: 422 }), async () =>
    Response.json({ items: [card], nextCursor: "next" }),
  );
  expect(page.items[0]?.slug).toBe("ramo-pinata");
  expect(page.nextCursor).toBe("next");
});

it("rejects a catalog payload that is not a page", async () => {
  await expect(
    pageFromResponse(Response.json({ items: "no" }), async () => Response.json({})),
  ).rejects.toThrow("No pudimos cargar el catálogo");
});

it("loads products through the service binding and drops a rejected filter", async () => {
  const urls: string[] = [];
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    urls.push(request.url);
    const url = new URL(request.url);
    if (urls.length === 1) return new Response("", { status: 422 });
    expect(url.pathname).toBe("/products");
    expect(url.searchParams.has("occasion")).toBe(false);
    return Response.json({ items: [card], nextCursor: null });
  });
  const page = await readCatalog({ occasion: "cumple" });
  expect(page.items.map((item) => item.slug)).toEqual(["ramo-pinata"]);
  expect(urls).toHaveLength(2);
});

it("maps a product 404 from the service binding", async () => {
  setApiFetch(async () => new Response("", { status: 404 }));
  const lookup = await readProduct("no-existe");
  expect(lookup.kind).toBe("missing");
});
