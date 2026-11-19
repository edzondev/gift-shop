export type Focusable = { focus: () => void };

export function fieldText(target: EventTarget | null): string {
  if (target !== null && "value" in target && typeof target.value === "string") return target.value;
  return "";
}

export function clearField(target: EventTarget | null): void {
  if (target !== null && "value" in target) Reflect.set(target, "value", "");
}

export function firstFile(target: EventTarget | null): File | null {
  if (target === null || !("files" in target)) return null;
  const files = target.files;
  if (typeof files !== "object" || files === null || !("item" in files)) return null;
  const item = files.item;
  if (typeof item !== "function") return null;
  const file: unknown = item.call(files, 0);
  return file instanceof File ? file : null;
}

export function focusable(node: unknown): Focusable | null {
  if (typeof node !== "object" || node === null || !("focus" in node)) return null;
  const focus = node.focus;
  if (typeof focus !== "function") return null;
  return {
    focus() {
      focus.call(node);
    },
  };
}
