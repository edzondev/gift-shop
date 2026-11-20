type Storage = {
  run: <T>(store: object, fn: () => T) => T;
};

function isStorage(value: unknown): value is Storage {
  return (
    typeof value === "object" && value !== null && "run" in value && typeof value.run === "function"
  );
}

function storage(key: symbol): Storage {
  const stored: unknown = Object.getOwnPropertyDescriptor(globalThis, key)?.value;
  if (!isStorage(stored)) throw new Error(`missing ${key.description ?? "storage"}`);
  return stored;
}

export function documentStatus(): number | undefined {
  const stored: unknown = Object.getOwnPropertyDescriptor(
    globalThis,
    Symbol.for("tanstack-start:event-storage"),
  )?.value;
  if (typeof stored !== "object" || stored === null || !("getStore" in stored)) return undefined;
  if (typeof stored.getStore !== "function") return undefined;
  const store: unknown = stored.getStore();
  if (typeof store !== "object" || store === null || !("responseState" in store)) return undefined;
  const state = store.responseState;
  if (typeof state !== "object" || state === null || !("status" in state)) return undefined;
  return typeof state.status === "number" ? state.status : undefined;
}

export function withAccessRequest<T>(token: string | undefined, run: () => T): T {
  const headers = new Headers();
  if (token !== undefined) headers.set("cookie", `admin_session=${encodeURIComponent(token)}`);
  const request = new Request("https://taller.test/admin", { headers });
  const start = storage(Symbol.for("tanstack-start:start-storage-context"));
  const event = storage(Symbol.for("tanstack-start:event-storage"));
  return start.run(
    {
      request,
      startOptions: {},
      contextAfterGlobalMiddlewares: {},
      handlerType: "serverFn",
      getRouter: () => {
        throw new Error("no router");
      },
    },
    () => event.run({ request }, run),
  );
}
