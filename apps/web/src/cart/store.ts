import { useSyncExternalStore } from "react";
import { isRecord } from "../record";
import {
  addLine,
  CART_STORAGE_KEY,
  type CartLine,
  cartFromStorage,
  parseStoredCart,
  removeLine,
  setLineQty,
} from "./logic";

const EMPTY: readonly CartLine[] = [];
const listeners = new Set<() => void>();

let snapshot: readonly CartLine[] = EMPTY;
let booted = false;

function hasKey<K extends string>(value: object, key: K): value is Record<K, unknown> {
  return key in value;
}

function storageBucket(): Record<string, unknown> | null {
  const scope: object = globalThis;
  if (!hasKey(scope, "localStorage")) return null;
  return isRecord(scope.localStorage) ? scope.localStorage : null;
}

function readRaw(storage: Record<string, unknown>): string | null {
  if (typeof storage.getItem !== "function") return null;
  const value: unknown = storage.getItem(CART_STORAGE_KEY);
  return typeof value === "string" ? value : null;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function readBrowserCart(): readonly CartLine[] {
  const storage = storageBucket();
  if (storage === null) return EMPTY;
  try {
    return parseStoredCart(readRaw(storage));
  } catch {
    return EMPTY;
  }
}

function persist(next: readonly CartLine[]): void {
  snapshot = next;
  const storage = storageBucket();
  if (storage !== null && typeof storage.setItem === "function") {
    try {
      storage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The tab still shows the cart if storage is full.
    }
  }
  emit();
}

function storageEvent(event: Event): { key: string | null; value: string | null } | null {
  if (!hasKey(event, "storageArea") || !hasKey(event, "key")) return null;
  const storage = storageBucket();
  if (storage === null || event.storageArea !== storage) return null;
  const key = event.key;
  if (typeof key !== "string" && key !== null) return null;
  const value = hasKey(event, "newValue") ? event.newValue : null;
  return { key, value: typeof value === "string" || value === null ? value : null };
}

export function subscribeCart(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const onStorage = (event: Event) => {
    const change = storageEvent(event);
    if (change === null) return;
    snapshot = cartFromStorage(change.key, change.value, snapshot);
    onStoreChange();
  };
  const scope: object = globalThis;
  if (hasKey(scope, "addEventListener") && typeof scope.addEventListener === "function") {
    scope.addEventListener("storage", onStorage);
  }
  snapshot = readBrowserCart();
  booted = true;
  return () => {
    listeners.delete(onStoreChange);
    if (hasKey(scope, "removeEventListener") && typeof scope.removeEventListener === "function") {
      scope.removeEventListener("storage", onStorage);
    }
  };
}

export function getCartSnapshot(): readonly CartLine[] {
  return snapshot;
}

export function getCartServerSnapshot(): readonly CartLine[] {
  return EMPTY;
}

export function getCartReadySnapshot(): boolean {
  return booted;
}

export function getCartReadyServerSnapshot(): boolean {
  return false;
}

export function useCartReady(): boolean {
  return useSyncExternalStore(subscribeCart, getCartReadySnapshot, getCartReadyServerSnapshot);
}

export function useCart(): readonly CartLine[] {
  return useSyncExternalStore(subscribeCart, getCartSnapshot, getCartServerSnapshot);
}

export function addToCart(line: CartLine): void {
  persist(addLine(snapshot, line));
}

export function changeLineQty(key: string, qty: number): void {
  persist(setLineQty(snapshot, key, qty));
}

export function removeFromCart(key: string): void {
  persist(removeLine(snapshot, key));
}

export function clearCart(): void {
  persist(EMPTY);
}
