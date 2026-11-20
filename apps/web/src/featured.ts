import { readCatalog } from "./catalog-api";
import type { FeaturedShelf } from "./featured-shelf";

const FEATURED_LIMIT = 4;
const FEATURED_TIMEOUT_MS = 4000;

async function loadShelf(): Promise<FeaturedShelf> {
  const page = await readCatalog({ occasion: undefined });
  const items = page.items.slice(0, FEATURED_LIMIT);
  if (items.length === 0) return { kind: "empty" };
  return { kind: "ready", items };
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function readFeatured(): Promise<FeaturedShelf> {
  try {
    return await withDeadline(loadShelf(), FEATURED_TIMEOUT_MS);
  } catch {
    return { kind: "unavailable" };
  }
}
