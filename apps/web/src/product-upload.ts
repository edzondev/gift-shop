import { errorCode } from "./admin-product-json";
import { readJsonLimited } from "./limited-json";
import { type PhotoRef, photoIssue } from "./product-photo";
import { isRecord } from "./record";

const JSON_LIMIT = 65_536;

export type PhotoMutation =
  | { kind: "created"; photo: PhotoRef }
  | { kind: "deleted" }
  | { kind: "rejected"; code: "file_too_large" | "unsupported_file_type" | "too_many_photos" }
  | { kind: "missing" }
  | { kind: "denied"; status: 401 | 403 }
  | { kind: "failed" };

function denied(status: number): status is 401 | 403 {
  return status === 401 || status === 403;
}

function photoRef(value: unknown): PhotoRef | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.key !== "string")
    return null;
  return { id: value.id, key: value.key };
}

function rejectedCode(
  code: string | null,
): "file_too_large" | "unsupported_file_type" | "too_many_photos" | null {
  switch (code) {
    case "file_too_large":
    case "unsupported_file_type":
    case "too_many_photos":
      return code;
    default:
      return null;
  }
}

async function classify(response: Response, created: boolean): Promise<PhotoMutation> {
  if (denied(response.status)) return { kind: "denied", status: response.status };
  if (response.status === 204 && !created) return { kind: "deleted" };
  const body = await readJsonLimited(response.body, JSON_LIMIT);
  if (response.status === 404 && errorCode(body) === "product_not_found")
    return { kind: "missing" };
  if (response.status === 404 && errorCode(body) === "photo_not_found") return { kind: "deleted" };
  const code = rejectedCode(errorCode(body));
  if (
    code !== null &&
    (response.status === 409 || response.status === 413 || response.status === 415)
  ) {
    return { kind: "rejected", code };
  }
  if (created && (response.status === 200 || response.status === 201)) {
    const photo = photoRef(body);
    if (photo === null) return { kind: "failed" };
    return { kind: "created", photo };
  }
  return { kind: "failed" };
}

export async function uploadProductPhoto(id: string, file: File): Promise<PhotoMutation> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const issue = photoIssue(file.size, head);
  if (issue !== null) return { kind: "rejected", code: issue };
  const response = await fetch(`/admin/productos/${encodeURIComponent(id)}/foto`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: file,
  });
  return classify(response, true);
}

export async function deleteProductPhoto(id: string, photoId: string): Promise<PhotoMutation> {
  const response = await fetch(
    `/admin/productos/${encodeURIComponent(id)}/foto/${encodeURIComponent(photoId)}`,
    { method: "DELETE" },
  );
  return classify(response, false);
}
