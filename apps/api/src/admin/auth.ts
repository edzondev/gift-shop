import { createMiddleware } from "hono/factory";
import { sign, verify } from "hono/jwt";
import * as v from "valibot";
import { type ApiEnv, internalError, unauthorized } from "../errors";
import { issuePath } from "../validation";

export const LOGIN_MAX_BYTES = 4 * 1024;
const ISSUER = "gift-shop-admin";
const WEEK_SECONDS = 7 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const loginSchema = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "email must not be empty"),
    v.maxLength(254, "email must be at most 254 characters"),
  ),
  password: v.pipe(
    v.string(),
    v.minLength(1, "password must not be empty"),
    v.maxLength(200, "password must be at most 200 characters"),
  ),
});

type LoginValue = v.InferOutput<typeof loginSchema>;
type Issue = { path: string; message: string };

export function parseLogin(
  text: string,
): { ok: true; value: LoginValue } | { ok: false; issues: Issue[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, issues: [{ path: "", message: "Invalid JSON" }] };
  }
  const parsed = v.safeParse(loginSchema, raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.issues.map((issue) => ({ path: issuePath(issue), message: issue.message })),
    };
  }
  return { ok: true, value: parsed.output };
}

function readEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email === "" ? null : email;
}

function readPassword(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  return value;
}

function readSecret(value: unknown): string | null {
  if (typeof value !== "string" || value.length < MIN_SECRET_LENGTH) return null;
  return value;
}

async function sameText(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  return crypto.subtle.timingSafeEqual(new Uint8Array(leftHash), new Uint8Array(rightHash));
}

export async function createSession(
  env: { ADMIN_EMAIL?: unknown; ADMIN_PASSWORD?: unknown; ADMIN_SESSION_SECRET?: unknown },
  input: LoginValue,
): Promise<
  | { type: "ok"; token: string; email: string; expiresAt: string }
  | { type: "misconfigured" }
  | { type: "rejected" }
> {
  const email = readEmail(env.ADMIN_EMAIL);
  const password = readPassword(env.ADMIN_PASSWORD);
  const secret = readSecret(env.ADMIN_SESSION_SECRET);
  if (email === null || password === null || secret === null) return { type: "misconfigured" };
  const emailMatches = await sameText(input.email.toLowerCase(), email);
  const passwordMatches = await sameText(input.password, password);
  if (!emailMatches || !passwordMatches) return { type: "rejected" };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + WEEK_SECONDS;
  const token = await sign({ sub: email, iss: ISSUER, iat, exp }, secret, "HS256");
  return { type: "ok", token, email, expiresAt: new Date(exp * 1000).toISOString() };
}

function bearerToken(header: string | undefined): string | null {
  if (header === undefined || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  if (!TOKEN.test(token)) return null;
  return token;
}

function unexpired(exp: unknown): boolean {
  return typeof exp === "number" && Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000);
}

function subjectOf(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

async function readPayload(token: string, secret: string) {
  try {
    const payload = await verify(token, secret, { alg: "HS256", exp: false });
    if (payload.iss !== ISSUER) return null;
    if (!unexpired(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const adminAuth = createMiddleware<ApiEnv>(async (c, next) => {
  const token = bearerToken(c.req.header("Authorization"));
  if (token === null) return c.json(unauthorized(), 401);
  const email = readEmail(c.env.ADMIN_EMAIL);
  const secret = readSecret(c.env.ADMIN_SESSION_SECRET);
  if (email === null || secret === null) return c.json(internalError(), 500);
  const payload = await readPayload(token, secret);
  if (payload === null) return c.json(unauthorized(), 401);
  if (!(await sameText(subjectOf(payload.sub), email))) return c.json(unauthorized(), 401);
  c.set("adminEmail", email);
  return next();
});
