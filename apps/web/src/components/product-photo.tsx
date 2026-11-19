const TONES = [
  "#ebdccb",
  "#e2d6c4",
  "#efe2c6",
  "#e5e3d3",
  "#ece5d8",
  "#f2ddd0",
  "#e3e6d6",
  "#c97b5d",
  "#8a9a5b",
  "#e3b448",
  "#e8b4a6",
  "#ede3d1",
];

function photoTone(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index)) % TONES.length;
  }
  return TONES[hash] ?? TONES[0] ?? "#ebdccb";
}

function frame(seed: string, className: string, label: string, decorative: boolean) {
  const tone = photoTone(seed);
  if (decorative) {
    return <div className={className} style={{ backgroundColor: tone }} aria-hidden="true" />;
  }
  return (
    <div className={className} style={{ backgroundColor: tone }} role="img" aria-label={label} />
  );
}

export function ProductPhoto({
  photoKeys,
  label,
  layout,
}: {
  photoKeys: readonly string[];
  label: string;
  layout: "card" | "detail";
}) {
  const mainSeed = photoKeys[0] ?? label;
  const main = frame(mainSeed, "product-photo", label, layout === "card");
  if (layout === "card") return main;
  const extras = photoKeys.slice(1);
  return (
    <div className="product-gallery">
      {main}
      {extras.length === 0 ? null : (
        <div className="product-photo-row">
          {extras.map((key) => (
            <div key={key}>{frame(key, "product-photo product-photo-thumb", label, true)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
