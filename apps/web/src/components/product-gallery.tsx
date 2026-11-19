import { useState } from "react";
import { choosePhoto, galleryKeys } from "../photo";
import { ProductPhoto } from "./product-photo";

export function ProductGallery({
  slug,
  photoKeys,
  label,
}: {
  slug: string;
  photoKeys: readonly string[];
  label: string;
}) {
  return <Gallery key={slug} photoKeys={galleryKeys(photoKeys)} label={label} />;
}

function Gallery({ photoKeys, label }: { photoKeys: readonly string[]; label: string }) {
  const [index, setIndex] = useState(0);
  const selected = choosePhoto(photoKeys.length, index);
  const shown = photoKeys[selected];
  return (
    <div className="product-gallery">
      <ProductPhoto
        key={shown ?? "sin-foto"}
        photoKey={shown}
        label={label}
        frame="main"
        priority
        decorative={false}
      />
      {photoKeys.length < 2 ? null : (
        <div className="product-photo-row">
          {photoKeys.map((key, photoIndex) => (
            <button
              key={`${photoIndex}:${key}`}
              type="button"
              className="product-thumb"
              aria-pressed={photoIndex === selected}
              aria-label={`Foto ${photoIndex + 1} de ${label}`}
              onClick={() => setIndex(choosePhoto(photoKeys.length, photoIndex))}
            >
              <ProductPhoto
                photoKey={key}
                label={label}
                frame="thumb"
                priority={false}
                decorative
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
