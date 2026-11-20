import { expect, it } from "vitest";
import { optionSummary } from "../src/cart/options";

const classic = { size: "clasica" } as const;

it("lists only the options that were chosen", () => {
  expect(optionSummary(classic)).toBe("Clásica");
  expect(optionSummary({ size: "grande" })).toBe("Grande");
  expect(
    optionSummary({
      size: "grande",
      name: "Ñandú 🌷",
      color: "oliva",
      card: { message: "Feliz día\ncon tildes" },
      wrap: true,
    }),
  ).toBe("Grande · Ñandú 🌷 · Oliva · Tarjeta · Envoltura");
  expect(optionSummary({ size: "clasica", wrap: false })).toBe("Clásica");
  expect(optionSummary(classic)).not.toContain("Tarjeta");
  expect(optionSummary(classic)).not.toContain("Envoltura");
});
