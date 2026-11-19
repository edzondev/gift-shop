import { expect, it } from "vitest";
import {
  canUpload,
  openPhoto,
  PHOTO_BYTES,
  photoIssue,
  photosAfterCreate,
  photosAfterReject,
} from "../src/product-photo";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const text = new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0, 0, 0, 0, 0, 0, 0]);

const photos = [
  { id: "a", key: "a" },
  { id: "b", key: "b" },
  { id: "c", key: "c" },
];

it("accepts jpeg, png, and webp up to 5 MB", () => {
  expect(photoIssue(PHOTO_BYTES, jpeg)).toBeNull();
  expect(photoIssue(12, png)).toBeNull();
  expect(photoIssue(12, webp)).toBeNull();
});

it("rejects a file over 5 MB and a file that is not a photo", () => {
  expect(photoIssue(PHOTO_BYTES + 1, jpeg)).toBe("file_too_large");
  expect(photoIssue(6 * 1024 * 1024, png)).toBe("file_too_large");
  expect(photoIssue(32, text)).toBe("unsupported_file_type");
  expect(photoIssue(0, jpeg)).toBe("unsupported_file_type");
});

it("stops at three photos", () => {
  expect(canUpload(0)).toBe(true);
  expect(canUpload(2)).toBe(true);
  expect(canUpload(3)).toBe(false);
  expect(photosAfterCreate(photos.slice(0, 2), photos[2] ?? { id: "c", key: "c" })).toHaveLength(3);
  expect(photosAfterCreate(photos, { id: "d", key: "d" })).toEqual(photos);
});

it("leaves the photo list untouched when the upload is rejected", () => {
  expect(photosAfterReject(photos)).toEqual(photos);
});

it("rejects a declared size over 5 MB before reading the body", async () => {
  const opened = await openPhoto(
    new Request("https://taller.test/foto", {
      method: "POST",
      headers: { "content-length": String(PHOTO_BYTES + 1) },
    }),
  );
  expect(opened).toEqual({ ok: false, status: 413 });
});
