import { expect, it } from "vitest";
import {
  beginLogin,
  beginLogout,
  checkLogin,
  clearSessionSetCookie,
  loginFailureMessage,
  loginResult,
  meResult,
  readSessionToken,
  requestIsSecure,
  sessionMaxAge,
  sessionSetCookie,
} from "../src/admin-session";

const WEEK = 7 * 24 * 60 * 60;
const NOW = Date.parse("2026-11-20T00:00:00.000Z");

it("builds admin_session with HttpOnly, SameSite=Lax, Path=/ and Max-Age from expiresAt", () => {
  const expiresAt = new Date(NOW + 3 * 24 * 60 * 60 * 1000).toISOString();
  const header = sessionSetCookie("jwt.uno.dos", sessionMaxAge(expiresAt, NOW), false);
  expect(header).toBe(
    `admin_session=${encodeURIComponent("jwt.uno.dos")}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${3 * 24 * 60 * 60}`,
  );
  expect(header).not.toContain("Secure");
});

it("adds Secure only when the request URL is https", () => {
  expect(requestIsSecure("https://gift-shop-web-develop.coolsubdomain.workers.dev/admin")).toBe(
    true,
  );
  expect(requestIsSecure("http://localhost:3000/admin/login")).toBe(false);
  const secure = sessionSetCookie(
    "jwt.uno.dos",
    WEEK,
    requestIsSecure("https://taller.test/admin"),
  );
  const local = sessionSetCookie(
    "jwt.uno.dos",
    WEEK,
    requestIsSecure("http://127.0.0.1:3000/admin"),
  );
  expect(secure).toContain("Secure");
  expect(local).not.toContain("Secure");
});

it("falls back to seven days when expiresAt is missing or already past", () => {
  expect(sessionMaxAge("no-es-fecha", NOW)).toBe(WEEK);
  expect(sessionMaxAge(new Date(NOW - 1000).toISOString(), NOW)).toBe(WEEK);
  expect(sessionMaxAge(new Date(NOW + WEEK * 1000).toISOString(), NOW)).toBe(WEEK);
});

it("clears admin_session with Max-Age=0 and the same Path, HttpOnly and SameSite", () => {
  const cleared = clearSessionSetCookie(true);
  expect(cleared).toBe("admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure");
  expect(clearSessionSetCookie(false)).not.toContain("Secure");
});

it("reads only the admin_session cookie and ignores other cookies", () => {
  expect(readSessionToken(null)).toBeUndefined();
  expect(readSessionToken("")).toBeUndefined();
  expect(readSessionToken("tema=claro")).toBeUndefined();
  expect(readSessionToken("admin_session=")).toBeUndefined();
  expect(readSessionToken("tema=claro; admin_session=jwt.uno.dos")).toBe("jwt.uno.dos");
  expect(readSessionToken(`admin_session=${encodeURIComponent("jwt.uno.dos")}; otra=1`)).toBe(
    "jwt.uno.dos",
  );
});

it("trims the email and keeps spaces, emoji and symbols in the password", () => {
  expect(checkLogin({ email: "  Ana@Taller.test  ", password: "  clave 🎁 !@#  " })).toEqual({
    ok: true,
    email: "Ana@Taller.test",
    password: "  clave 🎁 !@#  ",
  });
});

it("rejects an empty or blank email before a password is considered", () => {
  expect(checkLogin({ email: "", password: "clave" })).toEqual({
    ok: false,
    message: "Escribe tu correo.",
  });
  expect(checkLogin({ email: "   ", password: "clave" })).toEqual({
    ok: false,
    message: "Escribe tu correo.",
  });
});

it("rejects an empty password and does not trim it into acceptance", () => {
  expect(checkLogin({ email: "ana@taller.test", password: "" })).toEqual({
    ok: false,
    message: "Escribe tu contraseña.",
  });
  expect(checkLogin({ email: "ana@taller.test", password: "   " }).ok).toBe(true);
});

it("rejects an email or password that exceeds the API limits", () => {
  expect(checkLogin({ email: `${"a".repeat(255)}@b.c`, password: "clave" })).toEqual({
    ok: false,
    message: "El correo es demasiado largo.",
  });
  expect(checkLogin({ email: "ana@taller.test", password: "x".repeat(201) })).toEqual({
    ok: false,
    message: "La contraseña es demasiado larga.",
  });
  expect(checkLogin({ email: "a".repeat(254), password: "x".repeat(200) }).ok).toBe(true);
});

it("maps a 200 login body to the session and a 401 invalid_credentials to a refusal", () => {
  expect(
    loginResult(200, {
      token: "jwt.uno.dos",
      email: "ana@taller.test",
      expiresAt: "2026-11-27T00:00:00.000Z",
    }),
  ).toEqual({
    kind: "ok",
    token: "jwt.uno.dos",
    email: "ana@taller.test",
    expiresAt: "2026-11-27T00:00:00.000Z",
  });
  expect(
    loginResult(401, { error: { code: "invalid_credentials", message: "Invalid credentials" } }),
  ).toEqual({ kind: "invalid_credentials" });
  expect(loginFailureMessage("invalid_credentials")).toBe("Correo o contraseña incorrectos.");
});

it("maps 422 to invalid input and any other status to unavailable", () => {
  expect(
    loginResult(422, { error: { code: "validation_error", message: "Validation failed" } }),
  ).toEqual({
    kind: "invalid_input",
  });
  expect(
    loginResult(500, { error: { code: "internal_error", message: "Internal error" } }),
  ).toEqual({
    kind: "unavailable",
  });
  expect(loginResult(401, { error: { code: "unauthorized", message: "Unauthorized" } })).toEqual({
    kind: "unavailable",
  });
  expect(
    loginResult(200, {
      token: "",
      email: "ana@taller.test",
      expiresAt: "2026-11-27T00:00:00.000Z",
    }),
  ).toEqual({
    kind: "unavailable",
  });
  expect(loginFailureMessage("invalid_input")).toBe("Revisa el correo y la contraseña.");
  expect(loginFailureMessage("unavailable")).toBe("No pudimos entrar. Inténtalo de nuevo.");
});

it("maps GET /admin/me 200 to the email and 401 to unauthorized", () => {
  expect(meResult(200, { email: "ana@taller.test" })).toEqual({
    kind: "ok",
    email: "ana@taller.test",
  });
  expect(meResult(401, { error: { code: "unauthorized", message: "Unauthorized" } })).toEqual({
    kind: "unauthorized",
  });
  expect(meResult(200, { name: "Ana" })).toEqual({ kind: "unavailable" });
  expect(meResult(500, null)).toEqual({ kind: "unavailable" });
});

it("does not start a second login while isSubmitting is set", () => {
  const gate = { current: false };
  const fields = { email: "ana@taller.test", password: "clave" };
  expect(beginLogin(true, gate, fields)).toEqual({ kind: "ignored" });
  expect(gate.current).toBe(false);
});

it("does not start a second login click before the button rerenders", () => {
  const gate = { current: false };
  const fields = { email: "ana@taller.test", password: "clave 🎁" };
  expect(beginLogin(false, gate, fields)).toEqual({
    kind: "ready",
    email: "ana@taller.test",
    password: "clave 🎁",
  });
  expect(beginLogin(false, gate, fields)).toEqual({ kind: "ignored" });
});

it("does not start a second logout while isLoggingOut is set", () => {
  const gate = { current: false };
  expect(beginLogout(true, gate)).toEqual({ kind: "ignored" });
  expect(gate.current).toBe(false);
});

it("does not start a second logout click before the button rerenders", () => {
  const gate = { current: false };
  expect(beginLogout(false, gate)).toEqual({ kind: "ready" });
  expect(beginLogout(false, gate)).toEqual({ kind: "ignored" });
});
