import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PaymentFields } from "../src/checkout/payment";

it("prints the yape number and name that the server provided", () => {
  const html = renderToStaticMarkup(
    <PaymentFields
      yapeNumber="999111222"
      yapeName="Ana Artesana"
      totalCents={8900}
      operation=""
      fileName={null}
      error="Falta el número de operación"
      captureError="Sube la captura de tu Yape"
      sending={false}
      onOperation={() => undefined}
      onFile={() => undefined}
    />,
  );
  expect(html).toContain("Yapea y listo");
  expect(html).toContain("999111222");
  expect(html).toContain("Ana Artesana");
  expect(html).toContain("Falta el número de operación");
  expect(html).toContain("Sube la captura de tu Yape");
  expect(html).not.toContain("987 654 321");
  expect(html).not.toContain("Taller de Regalos");
});
