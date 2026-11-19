const SOLES = /^(?:0|[1-9]\d*)(?:[.,]\d{1,2})?$/;

export function solesToCents(raw: string): number | null {
  const text = raw.trim();
  if (!SOLES.test(text)) return null;
  const separator = text.search(/[.,]/);
  const whole = separator === -1 ? text : text.slice(0, separator);
  const fraction = separator === -1 ? "" : text.slice(separator + 1);
  const centsText = `${whole}${fraction.padEnd(2, "0")}`;
  if (centsText.length > 15) return null;
  const cents = Number(centsText);
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function centsLabel(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) return "";
  const whole = Math.trunc(cents / 100);
  const fraction = cents % 100;
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}
