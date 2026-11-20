import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { adminClient } from "./admin-api";
import {
  checkedLogin,
  clearSessionSetCookie,
  loginFailureMessage,
  loginResult,
  meResult,
  readSessionToken,
  requestIsSecure,
  sessionMaxAge,
  sessionSetCookie,
} from "./admin-session";

export type LoginView =
  | { kind: "ok" }
  | { kind: "invalid_credentials"; message: string }
  | { kind: "invalid_input"; message: string }
  | { kind: "unavailable"; message: string };

export type MeView = { kind: "ok" } | { kind: "unauthorized" } | { kind: "unavailable" };

export type SessionView = { kind: "missing" } | { kind: "present" };

function loginFailure(kind: "invalid_credentials" | "invalid_input" | "unavailable"): LoginView {
  return { kind, message: loginFailureMessage(kind) };
}

const directCall = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const followed = await next();
  if (
    ("result" in followed && followed.result !== undefined) ||
    !("kind" in followed) ||
    typeof followed.kind !== "string"
  ) {
    return followed;
  }
  const view: Record<string, unknown> = { kind: followed.kind };
  if ("message" in followed && typeof followed.message === "string")
    view.message = followed.message;
  return { ...followed, result: view };
});

function sessionSecure(): boolean {
  return requestIsSecure(getRequest().url);
}

export const adminSession = createServerFn({ method: "GET" })
  .middleware([directCall])
  .handler(async (): Promise<SessionView> => {
    const token = readSessionToken(getRequestHeader("cookie") ?? null);
    if (token === undefined) return { kind: "missing" };
    return { kind: "present" };
  });

export const adminMe = createServerFn({ method: "GET" })
  .middleware([directCall])
  .handler(async (): Promise<MeView> => {
    const token = readSessionToken(getRequestHeader("cookie") ?? null);
    if (token === undefined) return { kind: "unauthorized" };
    try {
      const response = await adminClient(token).admin.me.$get();
      const status = response.status;
      const body = status === 200 ? await response.json() : null;
      const me = meResult(status, body);
      if (me.kind === "ok") return { kind: "ok" };
      if (me.kind === "unauthorized") return { kind: "unauthorized" };
      return { kind: "unavailable" };
    } catch {
      return { kind: "unavailable" };
    }
  });

export const loginAdmin = createServerFn({ method: "POST" })
  .middleware([directCall])
  .validator((input: unknown) => input)
  .handler(async ({ data }): Promise<LoginView> => {
    const parsedInput = checkedLogin(data);
    if (!parsedInput.ok) return { kind: "invalid_input", message: parsedInput.message };
    try {
      const response = await adminClient(undefined).admin.login.$post({
        json: { email: parsedInput.email, password: parsedInput.password },
      });
      const status = response.status;
      const body = status === 200 || status === 401 ? await response.json() : null;
      const parsed = loginResult(status, body);
      if (parsed.kind !== "ok") return loginFailure(parsed.kind);
      setResponseHeader(
        "set-cookie",
        sessionSetCookie(
          parsed.token,
          sessionMaxAge(parsed.expiresAt, Date.now()),
          sessionSecure(),
        ),
      );
      return { kind: "ok" };
    } catch {
      return loginFailure("unavailable");
    }
  });

export const logoutAdmin = createServerFn({ method: "POST" })
  .middleware([directCall])
  .handler(async () => {
    setResponseHeader("set-cookie", clearSessionSetCookie(sessionSecure()));
    return { kind: "ok" as const };
  });
