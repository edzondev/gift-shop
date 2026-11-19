import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProductGallery } from "../src/components/product-gallery";
import { ProductPhoto } from "../src/components/product-photo";
import { choosePhoto, leadingPhotoIndex, photoIsBroken, photoView } from "../src/photo";

it("renders an image when the product has a key", () => {
  const html = renderToStaticMarkup(
    <ProductPhoto
      photoKey="photos/a.webp"
      label="Piñata 🎁"
      frame="main"
      priority
      decorative={false}
    />,
  );
  expect(html).toContain('src="/img/photos/a.webp"');
  expect(html).toContain('alt="Piñata 🎁"');
  expect(html).toContain('width="800"');
  expect(html).toContain('height="1000"');
  expect(html).toContain('fetchPriority="high"');
  expect(html).toContain('loading="eager"');
  expect(html).not.toContain('loading="lazy"');
});

it("renders the filler when there is no key", () => {
  const html = renderToStaticMarkup(
    <ProductPhoto
      photoKey={undefined}
      label="Sin foto"
      frame="main"
      priority={false}
      decorative={false}
    />,
  );
  expect(html).not.toContain("<img");
  expect(html).toContain('role="img"');
  expect(html).toContain('aria-label="Sin foto"');
  expect(html).toContain("product-photo");
  expect(
    photoView({
      photoKey: undefined,
      label: "Sin foto",
      frame: "main",
      priority: true,
      broken: false,
    }).kind,
  ).toBe("filler");
});

it("renders the filler when the photo failed or the key is unsafe", () => {
  expect(photoIsBroken("fotos/a.webp", "fotos/a.webp")).toBe(true);
  expect(photoIsBroken("fotos/a.webp", "fotos/b.webp")).toBe(false);
  const broken = photoView({
    photoKey: "fotos/a.webp",
    label: "Rota",
    frame: "main",
    priority: true,
    broken: true,
  });
  const unsafe = renderToStaticMarkup(
    <ProductPhoto photoKey="../x" label="Malo" frame="main" priority decorative />,
  );
  expect(broken.kind).toBe("filler");
  expect(unsafe).not.toContain("<img");
  expect(unsafe).toContain("product-photo");
});

it("keeps the last thumbnail and ignores an older failure", () => {
  const keys = ["fotos/a.webp", "fotos/b.webp", "fotos/c.webp"];
  let index = 0;
  index = choosePhoto(keys.length, 2);
  index = choosePhoto(keys.length, 0);
  index = choosePhoto(keys.length, 1);
  const shown = keys[index];
  expect(shown).toBe("fotos/b.webp");
  expect(photoIsBroken("fotos/c.webp", shown)).toBe(false);
  expect(photoIsBroken(shown ?? null, shown)).toBe(true);
});

it("resets the chosen photo when the slug changes", () => {
  const first = ProductGallery({
    slug: "ramo",
    photoKeys: ["a.webp", "b.webp"],
    label: "Ramo",
  });
  const second = ProductGallery({
    slug: "taza",
    photoKeys: ["c.webp"],
    label: "Taza",
  });
  expect(first.key).toBe("ramo");
  expect(second.key).toBe("taza");
});

it("shows up to three photos and lazy thumbnails", () => {
  const html = renderToStaticMarkup(
    <ProductGallery
      slug="ramo"
      photoKeys={["a.webp", "b.webp", "c.webp", "d.webp"]}
      label="Ramo 🎁"
    />,
  );
  expect(html).toContain('src="/img/a.webp"');
  expect(html).toContain('src="/img/b.webp"');
  expect(html).toContain('src="/img/c.webp"');
  expect(html).not.toContain("/img/d.webp");
  expect(html).toContain('alt="Ramo 🎁"');
  expect(html).toContain('fetchPriority="high"');
  expect(html).toContain('aria-label="Foto 1 de Ramo 🎁"');
  expect(html).toContain('aria-label="Foto 3 de Ramo 🎁"');
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('aria-pressed="false"');
  expect(html).toContain('width="400"');
  expect(html).toContain('height="400"');
  expect(html.match(/loading="lazy"/g)).toHaveLength(3);
});

it("shows one photo without thumbnails and a filler when there are none", () => {
  const one = renderToStaticMarkup(
    <ProductGallery slug="solo" photoKeys={["solo.webp"]} label="Solo" />,
  );
  expect(one).toContain('src="/img/solo.webp"');
  expect(one).not.toContain("<button");

  const none = renderToStaticMarkup(<ProductGallery slug="vacio" photoKeys={[]} label="Vacío" />);
  expect(none).not.toContain("<img");
  expect(none).toContain('aria-label="Vacío"');
  expect(none).toContain("product-photo");
});

it("prioritizes the first card that actually has a photo", () => {
  expect(leadingPhotoIndex([0, 0, 2])).toBe(2);
  expect(leadingPhotoIndex([1, 3])).toBe(0);
  expect(leadingPhotoIndex([0, 0])).toBe(-1);
});
