import { expect, it } from "vitest";
import { graphemeCount, limitGraphemes, NAME_LIMIT, preparedName } from "../src/name";

const family = "👨‍👩‍👧‍👦";

it("counts emoji by grapheme and keeps spaces until validation", () => {
  expect(graphemeCount("")).toBe(0);
  expect(graphemeCount(family)).toBe(1);
  expect(family.length).toBeGreaterThan(1);
  expect(limitGraphemes("  Ana  ", NAME_LIMIT)).toBe("  Ana  ");
  expect(preparedName("  Ana  ")).toBe("Ana");
  expect(preparedName("   ")).toBe("");
  expect(limitGraphemes("a".repeat(NAME_LIMIT), NAME_LIMIT)).toBe("a".repeat(NAME_LIMIT));
  expect(limitGraphemes("a".repeat(NAME_LIMIT + 1), NAME_LIMIT)).toBe("a".repeat(NAME_LIMIT));
  expect(graphemeCount(limitGraphemes(family.repeat(NAME_LIMIT + 1), NAME_LIMIT))).toBe(NAME_LIMIT);
  expect(limitGraphemes(family.repeat(NAME_LIMIT + 1), NAME_LIMIT)).toBe(family.repeat(NAME_LIMIT));
});
