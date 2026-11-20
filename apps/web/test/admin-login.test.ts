import { getResponseHeader } from "@tanstack/react-start/server";
import { beforeEach, expect, it } from "vitest";
import { loginFailureMessage, sessionSetCookie } from "../src/admin-session";
import { adminMe, loginAdmin, logoutAdmin } from "../src/admin-session.functions";
import { resetApiFetch, setApiFetch } from "./cloudflare-workers-stub";
import { renderPath } from "./render-path";
import { withAccessRequest } from "./start-request";

function requestOf(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? input : new Request(input, init);
}

beforeEach(() => {
  resetApiFetch();
});

it("sets admin_session on a valid login and does not return the token or the password", async () => {
  const token = "jwt.uno.dos";
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    expect(request.headers.get("authorization")).toBeNull();
    expect(await request.json()).toEqual({ email: "ana@taller.test", password: "clave 🎁" });
    return Response.json({ token, email: "ana@taller.test", expiresAt });
  });
  const seen = await withAccessRequest(undefined, async () => {
    const view = await loginAdmin({ data: { email: "  ana@taller.test  ", password: "clave 🎁" } });
    return { view, header: getResponseHeader("set-cookie") ?? "" };
  });
  expect(seen.view).toEqual({ kind: "ok" });
  expect(JSON.stringify(seen.view)).not.toContain(token);
  expect(JSON.stringify(seen.view)).not.toContain("clave");
  const maxAge = Number(/Max-Age=(\d+)/.exec(seen.header)?.[1]);
  const expected = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
  expect(Math.abs(maxAge - expected)).toBeLessThanOrEqual(2);
  expect(seen.header).toBe(sessionSetCookie(token, maxAge, true));
  expect(seen.header).toContain("HttpOnly");
});

it("does not set a cookie when the API rejects the credentials", async () => {
  setApiFetch(async () =>
    Response.json(
      { error: { code: "invalid_credentials", message: "Invalid credentials" } },
      { status: 401 },
    ),
  );
  const seen = await withAccessRequest(undefined, async () => {
    const view = await loginAdmin({
      data: { email: "ana@taller.test", password: "clave-secreta" },
    });
    return { view, header: getResponseHeader("set-cookie") ?? "" };
  });
  expect(seen.view).toEqual({
    kind: "invalid_credentials",
    message: loginFailureMessage("invalid_credentials"),
  });
  expect(JSON.stringify(seen.view)).not.toContain("clave-secreta");
  expect(seen.header).not.toContain("admin_session");
});

it("maps a 422 login to invalid input without calling through a cookie", async () => {
  setApiFetch(async () =>
    Response.json(
      { error: { code: "validation_error", message: "Validation failed" } },
      { status: 422 },
    ),
  );
  const seen = await withAccessRequest(undefined, async () => {
    const view = await loginAdmin({ data: { email: "ana@taller.test", password: "clave" } });
    return { view, header: getResponseHeader("set-cookie") ?? "" };
  });
  expect(seen.view.kind).toBe("invalid_input");
  if (seen.view.kind !== "invalid_input") return;
  expect(seen.view.message).toBe(loginFailureMessage("invalid_input"));
  expect(seen.header).toBe("");
});

it("does not call the API for an empty password and reports the field", async () => {
  let called = false;
  setApiFetch(async () => {
    called = true;
    return new Response("", { status: 500 });
  });
  const view = await withAccessRequest(undefined, () =>
    loginAdmin({ data: { email: "ana@taller.test", password: "" } }),
  );
  expect(called).toBe(false);
  expect(view).toEqual({ kind: "invalid_input", message: "Escribe tu contraseña." });
});

it("reports a network failure without setting a cookie", async () => {
  setApiFetch(() => Promise.reject(new Error("socket")));
  const seen = await withAccessRequest(undefined, async () => {
    const view = await loginAdmin({ data: { email: "ana@taller.test", password: "clave" } });
    return { view, header: getResponseHeader("set-cookie") ?? "" };
  });
  expect(seen.view).toEqual({ kind: "unavailable", message: loginFailureMessage("unavailable") });
  expect(seen.header).toBe("");
});

it("treats a missing cookie as logged out and does not call /admin/me", async () => {
  let called = false;
  setApiFetch(async () => {
    called = true;
    return Response.json({ email: "ana@taller.test" });
  });
  const view = await withAccessRequest(undefined, () => adminMe());
  expect(called).toBe(false);
  expect(view).toEqual({ kind: "unauthorized" });
});

it("accepts /admin/me 200 and rejects 401", async () => {
  setApiFetch(async () => Response.json({ email: "ana@taller.test" }));
  const ok = await withAccessRequest("jwt.uno.dos", () => adminMe());
  expect(ok).toEqual({ kind: "ok" });
  expect(JSON.stringify(ok)).not.toContain("jwt.uno.dos");

  setApiFetch(async () =>
    Response.json({ error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 }),
  );
  const rejected = await withAccessRequest("jwt.uno.dos", () => adminMe());
  expect(rejected).toEqual({ kind: "unauthorized" });
});

it("clears admin_session with Max-Age=0", async () => {
  const seen = await withAccessRequest("jwt.uno.dos", async () => {
    const view = await logoutAdmin();
    return { view, header: getResponseHeader("set-cookie") ?? "" };
  });
  expect(seen.view).toEqual({ kind: "ok" });
  const header = seen.header;
  expect(header).toContain("admin_session=");
  expect(header).toContain("Max-Age=0");
  expect(header).toContain("HttpOnly");
  // biome-ignore lint/security/noSecrets: atributo SameSite de la cookie, no es un secreto
  expect(header).toContain("SameSite=Lax");
  expect(header).toContain("Path=/");
  expect(header).toContain("Secure");
  expect(header).not.toContain("jwt.uno.dos");
});

it("shows the login form when nobody is logged in", async () => {
  let called = false;
  setApiFetch(async () => {
    called = true;
    return Response.json({ email: "ana@taller.test" });
  });
  const page = await renderPath("/admin/login", "anonymous");
  expect(called).toBe(false);
  expect(page.pathname).toBe("/admin/login");
  expect(page.status).toBe(200);
  expect(page.html).toContain("Entrar");
  expect(page.html).toContain("Contraseña");
  expect(page.html).toContain(">Correo<");
});

it("sends a valid session from /admin/login to the panel", async () => {
  setApiFetch(async (input, init) => {
    const request = requestOf(input, init);
    const path = new URL(request.url).pathname;
    if (path === "/admin/me") {
      expect(request.headers.get("authorization")).toBe("Bearer sesion-de-prueba");
      return Response.json({ email: "ana@taller.test" });
    }
    if (path === "/admin/summary") {
      return Response.json({
        newToday: 0,
        toVerify: 0,
        weekVerifiedSalesCents: 0,
        pending: [],
        upcoming: [],
        lowStock: [],
      });
    }
    return new Response("", { status: 404 });
  });
  const page = await renderPath("/admin/login");
  expect(page.pathname).toBe("/admin");
  expect(page.html).toContain("Buenos días");
  expect(page.html).not.toContain("Contraseña");
});
