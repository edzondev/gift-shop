const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export function formatSoles(cents: number): string {
  return soles.format(cents / 100);
}
