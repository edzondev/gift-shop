import { expect, it } from "vitest";
import { catalogSearch } from "../src/catalog-search";
import { OCCASION_IDS } from "../src/occasions";

it("keeps a valid occasion and drops an invalid or missing one", () => {
  expect(catalogSearch({})).toEqual({ occasion: undefined });
  expect(catalogSearch({ page: "1" })).toEqual({ occasion: undefined });
  for (const occasion of OCCASION_IDS) {
    expect(catalogSearch({ occasion })).toEqual({ occasion });
  }
  expect(catalogSearch({ occasion: "xyz" })).toEqual({ occasion: undefined });
  expect(catalogSearch({ occasion: "cumple " })).toEqual({ occasion: undefined });
  expect(catalogSearch({ occasion: 1 })).toEqual({ occasion: undefined });
  expect(catalogSearch({ occasion: "" })).toEqual({ occasion: undefined });
});
