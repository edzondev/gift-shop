import { formatSoles } from "../money";

export function PriceRow({ cents, oldCents }: { cents: number; oldCents: number | null }) {
  return (
    <p className="price">
      <span>{formatSoles(cents)}</span>
      {oldCents === null ? null : <s>{formatSoles(oldCents)}</s>}
    </p>
  );
}
