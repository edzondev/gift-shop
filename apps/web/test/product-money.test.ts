import { expect, it } from "vitest";
import { centsLabel, solesToCents } from "../src/product-money";

const accepted = [
  ["12,50", 1250],
  ["12.5", 1250],
  ["12.50", 1250],
  ["12", 1200],
  ["0", 0],
  ["0,50", 50],
  ["0.29", 29],
  ["10.10", 1010],
  ["19.99", 1999],
  ["  8,5  ", 850],
] as const;

const rejected = [
  "",
  "-1",
  "-0,01",
  "12.501",
  "12,501",
  "abc",
  "12 50",
  "1.2.3",
  "🎁",
  "12.",
  ".5",
  "01",
];

it("converts soles to cents on the decimal edges", () => {
  for (const [raw, cents] of accepted) {
    expect(solesToCents(raw), raw).toBe(cents);
    expect(Number.isSafeInteger(solesToCents(raw))).toBe(true);
  }
});

it("rejects empty, negative, and inexact prices", () => {
  for (const raw of rejected) expect(solesToCents(raw), raw).toBeNull();
});

it("round-trips cents without a binary fraction", () => {
  expect(centsLabel(1010)).toBe("10.10");
  expect(centsLabel(29)).toBe("0.29");
  expect(solesToCents(centsLabel(1010))).toBe(1010);
  expect(solesToCents(centsLabel(29))).toBe(29);
});
