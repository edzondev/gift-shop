export const PRODUCT_FIELDS = [
  "name",
  "slug",
  "price",
  "oldPrice",
  "prepDays",
  "description",
  "occasions",
  "tag",
  "classic",
  "large",
  "largeExtra",
  "fields",
  "active",
  "initialStock",
] as const;

export type ProductField = (typeof PRODUCT_FIELDS)[number];

export type FieldMessages = Partial<Record<ProductField, string>> & { form?: string };

const SLUG_TAKEN = "Ese slug ya está en uso.";

export function fieldForApiPath(path: string): ProductField | null {
  switch (path) {
    case "slug":
      return "slug";
    case "name":
      return "name";
    case "priceCents":
      return "price";
    case "oldPriceCents":
      return "oldPrice";
    case "prepDays":
      return "prepDays";
    case "description":
      return "description";
    case "tag":
      return "tag";
    case "active":
      return "active";
    case "initialStock":
      return "initialStock";
    case "sizes":
    case "sizes.classic":
      return "classic";
    case "sizes.large":
      return "large";
    case "sizes.largeExtraCents":
      return "largeExtra";
    default:
      break;
  }
  if (path.startsWith("fields")) return "fields";
  if (path.startsWith("occasions")) return "occasions";
  return null;
}

export function fieldsFromApiIssues(issues: readonly { path: string; message: string }[]): {
  fields: FieldMessages;
} {
  const fields: FieldMessages = {};
  for (const issue of issues) {
    const field = fieldForApiPath(issue.path);
    if (field === null) {
      if (fields.form === undefined) fields.form = issue.message;
      continue;
    }
    if (fields[field] === undefined) fields[field] = issue.message;
  }
  return { fields };
}

export function slugTakenFields(): FieldMessages {
  return { slug: SLUG_TAKEN };
}

export function photoNotice(code: string): string | null {
  switch (code) {
    case "too_many_photos":
      return "Un producto puede tener hasta 3 fotos.";
    case "file_too_large":
      return "La foto pesa más de 5 MB.";
    case "unsupported_file_type":
      return "La foto tiene que ser JPEG, PNG o WebP.";
    default:
      return null;
  }
}
