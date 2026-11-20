import { useState } from "react";
import { type PhotoFrame, photoIsBroken, photoView } from "../photo";

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

export function ProductPhoto({
  photoKey,
  label,
  frame,
  priority,
  decorative,
  cover = false,
}: {
  photoKey: string | undefined;
  label: string;
  frame: PhotoFrame;
  priority: boolean;
  decorative: boolean;
  cover?: boolean;
}) {
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const view = photoView({
    photoKey,
    label,
    frame,
    priority,
    broken: photoIsBroken(failedKey, photoKey),
  });
  const framed = frame === "main" ? "product-photo" : "product-photo product-photo-thumb";
  const className = cover ? `${framed} product-photo-cover` : framed;
  const style = cover
    ? { backgroundColor: photoTone(photoKey ?? label) }
    : {
        backgroundColor: photoTone(photoKey ?? label),
        aspectRatio: frame === "main" ? "4 / 5" : "1",
      };
  if (view.kind === "filler" && decorative) {
    return <span className={className} style={style} aria-hidden="true" />;
  }
  if (view.kind === "filler") {
    return <span className={className} style={style} role="img" aria-label={label} />;
  }
  return (
    <span className={className} style={style}>
      <img
        src={view.src}
        alt={view.alt}
        width={view.width}
        height={view.height}
        loading={view.loading}
        fetchPriority={view.fetchPriority}
        onError={() => {
          if (photoKey !== undefined) setFailedKey(photoKey);
        }}
      />
    </span>
  );
}
