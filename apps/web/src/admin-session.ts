import { isRecord } from "./record";

const WEEK_SECONDS = 7 * 24 * 60 * 60;
const EMAIL_MAX = 254;
const PASSWORD_MAX = 200;

export type LoginFields = { email: string; password: string };

export type CheckedLogin =
  | { ok: true; email: string; password: string }
  | { ok: false; message: string };

export type LoginResult =
  | { kind: "ok"; token: string; email: string; expiresAt: string }
  | { kind: "invalid_credentials" }
  | { kind: "invalid_input" }
  | { kind: "unavailable" };

export type MeResult =
  | { kind: "ok"; email: string }
  | { kind: "unauthorized" }
  | { kind: "unavailable" };

export type LoginAttempt =
  | { kind: "ignored" }
  | { kind: "invalid"; message: string }
  | { kind: "ready"; email: string; password: string };

export type LogoutAttempt = { kind: "ignored" } | { kind: "ready" };

export function requestIsSecure(url: string): boolean {
  return url.startsWith("https:");
}

export function sessionMaxAge(expiresAt: string, nowMs: number): number {
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) return WEEK_SECONDS;
  const seconds = Math.floor((expiresMs - nowMs) / 1000);
  if (seconds <= 0) return WEEK_SECONDS;
  return seconds;
}

export function sessionSetCookie(token: string, maxAge: number, secure: boolean): string {
  const parts = [
    `admin_session=${encodeURIComponent(token)}`,
    "HttpOnly",
    // biome-ignore lint/security/noSecrets: atributo SameSite de la cookie, no es un secreto
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionSetCookie(secure: boolean): string {
  return sessionSetCookie("", 0, secure);
}

export function readSessionToken(cookieHeader: string | null): string | undefined {
  if (cookieHeader === null || cookieHeader === "") return undefined;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const splitAt = trimmed.indexOf("=");
    if (splitAt === -1 || trimmed.slice(0, splitAt) !== "admin_session") continue;
    const raw = trimmed.slice(splitAt + 1);
    if (raw === "") return undefined;
    try {
      const token = decodeURIComponent(raw);
      return token === "" ? undefined : token;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function checkLogin(fields: LoginFields): CheckedLogin {
  const email = fields.email.trim();
  if (email.length === 0) return { ok: false, message: "Escribe tu correo." };
  if (email.length > EMAIL_MAX) return { ok: false, message: "El correo es demasiado largo." };
  if (fields.password.length === 0) return { ok: false, message: "Escribe tu contraseña." };
  if (fields.password.length > PASSWORD_MAX) {
    return { ok: false, message: "La contraseña es demasiado larga." };
  }
  return { ok: true, email, password: fields.password };
}

export function checkedLogin(input: unknown): CheckedLogin {
  if (!isRecord(input) || typeof input.email !== "string" || typeof input.password !== "string") {
    return { ok: false, message: loginFailureMessage("invalid_input") };
  }
  return checkLogin({ email: input.email, password: input.password });
}

function textField(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  return value;
}

export function loginResult(status: number, body: unknown): LoginResult {
  if (status === 200) {
    if (!isRecord(body)) return { kind: "unavailable" };
    const token = textField(body.token);
    const email = textField(body.email);
    const expiresAt = textField(body.expiresAt);
    if (token === null || email === null || expiresAt === null) return { kind: "unavailable" };
    return { kind: "ok", token, email, expiresAt };
  }
  if (
    status === 401 &&
    isRecord(body) &&
    isRecord(body.error) &&
    body.error.code === "invalid_credentials"
  ) {
    return { kind: "invalid_credentials" };
  }
  if (status === 422) return { kind: "invalid_input" };
  return { kind: "unavailable" };
}

export function loginFailureMessage(
  kind: "invalid_credentials" | "invalid_input" | "unavailable",
): string {
  switch (kind) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "invalid_input":
      return "Revisa el correo y la contraseña.";
    case "unavailable":
      return "No pudimos entrar. Inténtalo de nuevo.";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function meResult(status: number, body: unknown): MeResult {
  if (status === 200 && isRecord(body)) {
    const email = textField(body.email);
    if (email !== null) return { kind: "ok", email };
  }
  if (status === 401) return { kind: "unauthorized" };
  return { kind: "unavailable" };
}

export function beginLogin(
  isSubmitting: boolean,
  gate: { current: boolean },
  fields: LoginFields,
): LoginAttempt {
  if (isSubmitting || gate.current) return { kind: "ignored" };
  const checked = checkLogin(fields);
  if (!checked.ok) return { kind: "invalid", message: checked.message };
  gate.current = true;
  return { kind: "ready", email: checked.email, password: checked.password };
}

export function beginLogout(isLoggingOut: boolean, gate: { current: boolean }): LogoutAttempt {
  if (isLoggingOut || gate.current) return { kind: "ignored" };
  gate.current = true;
  return { kind: "ready" };
}

export function releaseSubmit(gate: { current: boolean }): void {
  gate.current = false;
}
