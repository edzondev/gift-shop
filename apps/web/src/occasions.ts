import type { Occasion } from "api";

function occasionIds<const T extends readonly Occasion[]>(values: T): T {
  return values;
}

export const OCCASION_IDS = occasionIds(["cumple", "aniversario", "sanvalentin", "mama", "bebe"]);

export const OCCASIONS: readonly { id: Occasion; label: string }[] = [
  { id: "cumple", label: "Cumpleaños" },
  { id: "aniversario", label: "Aniversario" },
  { id: "sanvalentin", label: "San Valentín" },
  { id: "mama", label: "Para mamá" },
  { id: "bebe", label: "Baby shower" },
];
