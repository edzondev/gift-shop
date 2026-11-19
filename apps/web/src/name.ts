export const NAME_LIMIT = 14;

const graphemes = new Intl.Segmenter("es", { granularity: "grapheme" });

export function graphemeCount(value: string): number {
  return [...graphemes.segment(value)].length;
}

export function limitGraphemes(value: string, max: number): string {
  let count = 0;
  let end = 0;
  for (const { segment } of graphemes.segment(value)) {
    if (count === max) break;
    count += 1;
    end += segment.length;
  }
  return value.slice(0, end);
}

export function preparedName(value: string): string {
  return value.trim();
}
