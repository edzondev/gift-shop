export function encodedImageKey(key: string): string | null {
  if (key.length === 0 || key.includes("..")) return null;
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
