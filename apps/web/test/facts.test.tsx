import type { ProductCard } from "api";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProductFacts } from "../src/components/product-facts";
import { prepDaysLabel, stockNotice } from "../src/facts";

function product(patch: Pick<ProductCard, "prepDays" | "stockLeft">): ProductCard {
  return {
    slug: "caja",
    name: "Caja",
    priceCents: 3500,
    oldPriceCents: null,
    tag: null,
    occasions: ["cumple"],
    customizable: false,
    photoKeys: [],
    ...patch,
  };
}

it("uses día only when preparation is one day", () => {
  expect(prepDaysLabel(1)).toBe("Listo en 1 día");
  expect(prepDaysLabel(0)).toBe("Listo en 0 días");
  expect(prepDaysLabel(3)).toBe("Listo en 3 días");
  const html = renderToStaticMarkup(
    <ProductFacts product={product({ prepDays: 1, stockLeft: 2 })} />,
  );
  expect(html).toContain("<li>Listo en 1 día</li>");
  expect(html).not.toContain("días");
});

it("says Agotado when nothing is left", () => {
  expect(stockNotice(0)).toEqual({ kind: "agotado" });
  expect(stockNotice(2)).toEqual({ kind: "left", count: 2 });
  expect(stockNotice(null)).toEqual({ kind: "hidden" });
  const html = renderToStaticMarkup(
    <ProductFacts product={product({ prepDays: 2, stockLeft: 0 })} />,
  );
  expect(html).toContain("Agotado");
  expect(html).not.toContain("Quedan 0");
  expect(html).not.toContain("Quedan");
});

it("keeps the remaining count when stock is still available", () => {
  const html = renderToStaticMarkup(
    <ProductFacts product={product({ prepDays: 3, stockLeft: 2 })} />,
  );
  expect(html).toContain("<li>Listo en 3 días</li>");
  expect(html).toContain("Quedan 2");
  expect(html).not.toContain("Agotado");
});
