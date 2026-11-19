import { expect, it } from "vitest";
import {
  fieldForApiPath,
  fieldsFromApiIssues,
  photoNotice,
  slugTakenFields,
} from "../src/product-errors";

const paths = [
  ["slug", "slug"],
  ["name", "name"],
  ["priceCents", "price"],
  ["oldPriceCents", "oldPrice"],
  ["prepDays", "prepDays"],
  ["description", "description"],
  ["fields", "fields"],
  ["fields.0", "fields"],
  ["occasions", "occasions"],
  ["occasions.1", "occasions"],
  ["tag", "tag"],
  ["sizes.classic", "classic"],
  ["sizes.large", "large"],
  ["sizes.largeExtraCents", "largeExtra"],
  ["active", "active"],
  ["initialStock", "initialStock"],
] as const;

it("maps every validation path onto its field", () => {
  for (const [path, field] of paths) {
    expect(fieldForApiPath(path), path).toBe(field);
    const mapped = fieldsFromApiIssues([{ path, message: `err:${path}` }]);
    expect(mapped.fields[field], path).toBe(`err:${path}`);
  }
});

it("keeps an unknown validation path as a form message", () => {
  const mapped = fieldsFromApiIssues([{ path: "photo", message: "photo must be a file" }]);
  expect(mapped.fields.form).toBe("photo must be a file");
});

it("puts slug_taken on the slug field", () => {
  expect(slugTakenFields().slug).toMatch(/slug/i);
});

it("maps photo errors to a readable notice", () => {
  expect(photoNotice("too_many_photos")).toMatch(/3 fotos/);
  expect(photoNotice("file_too_large")).toMatch(/5 MB/);
  expect(photoNotice("unsupported_file_type")).toMatch(/JPEG/);
  expect(photoNotice("other")).toBeNull();
});
