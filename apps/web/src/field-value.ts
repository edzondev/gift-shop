export function controlValue(target: unknown): string {
  if (typeof target !== "object" || target === null || !("value" in target)) return "";
  return typeof target.value === "string" ? target.value : "";
}

export function firstFile(target: unknown): File | null {
  if (typeof target !== "object" || target === null || !("files" in target)) return null;
  const list: unknown = target.files;
  if (typeof list !== "object" || list === null || !("item" in list)) return null;
  if (typeof list.item !== "function") return null;
  const file: unknown = list.item(0);
  return file instanceof File ? file : null;
}

function hasKey<K extends string>(value: object, key: K): value is Record<K, unknown> {
  return key in value;
}

export function focusById(id: string): void {
  const scope: object = globalThis;
  if (!hasKey(scope, "document")) return;
  const doc = scope.document;
  // biome-ignore lint/security/noSecrets: nombre del método del DOM, no es una credencial
  if (typeof doc !== "object" || doc === null || !hasKey(doc, "getElementById")) return;
  if (typeof doc.getElementById !== "function") return;
  const node: unknown = doc.getElementById(id);
  if (typeof node !== "object" || node === null || !hasKey(node, "focus")) return;
  if (typeof node.focus !== "function") return;
  node.focus();
}

export function afterPaint(run: () => void): void {
  const scope: object = globalThis;
  if (!hasKey(scope, "requestAnimationFrame")) {
    run();
    return;
  }
  const frame = scope.requestAnimationFrame;
  if (typeof frame !== "function") {
    run();
    return;
  }
  frame(run);
}
