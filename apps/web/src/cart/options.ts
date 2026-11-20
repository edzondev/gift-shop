import { colorLabel } from "../labels";
import type { CartLine } from "./logic";

export function optionSummary(
  line: Pick<CartLine, "size" | "name" | "color" | "card" | "wrap">,
): string {
  const parts = [line.size === "grande" ? "Grande" : "Clásica"];
  if (line.name !== undefined) parts.push(line.name);
  if (line.color !== undefined) parts.push(colorLabel(line.color));
  if (line.card !== undefined) parts.push("Tarjeta");
  if (line.wrap === true) parts.push("Envoltura");
  return parts.join(" · ");
}
