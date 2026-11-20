import { env } from "cloudflare:workers";
import { sign } from "hono/jwt";
import app from "../src/index";

export const ADMIN_EMAIL = "yashira@example.com";
export const ADMIN_PASSWORD = "clave-exacta";
export const SESSION_SECRET = "test-session-secret-not-real-32b";
export const ISSUER = "gift-shop-admin";

type Overrides = {
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  omitPassword?: boolean;
  omitSecret?: boolean;
};

export function bindings(overrides: Overrides = {}) {
  const base = {
    DB: env.DB,
    FILES: env.FILES,
    ADMIN_EMAIL: overrides.ADMIN_EMAIL ?? ADMIN_EMAIL,
  };
  const withPassword =
    overrides.omitPassword === true
      ? base
      : { ...base, ADMIN_PASSWORD: overrides.ADMIN_PASSWORD ?? ADMIN_PASSWORD };
  if (overrides.omitSecret === true) return withPassword;
  return {
    ...withPassword,
    ADMIN_SESSION_SECRET: overrides.ADMIN_SESSION_SECRET ?? SESSION_SECRET,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function loginToken(): Promise<string> {
  const response = await app.request(
    "/admin/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    },
    bindings(),
  );
  if (response.status !== 200) throw new Error(`login status ${response.status}`);
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.token !== "string") throw new Error("login token missing");
  return body.token;
}

export async function sessionToken(
  secret: string,
  claims: { sub?: string; iss?: string; iat?: number; exp?: number } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: claims.sub ?? ADMIN_EMAIL,
      iss: claims.iss ?? ISSUER,
      iat: claims.iat ?? now,
      exp: claims.exp ?? now + 3600,
    },
    secret,
    "HS256",
  );
}

export async function hs384Token(secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: ADMIN_EMAIL, iss: ISSUER, iat: now, exp: now + 3600 }, secret, "HS384");
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function unsignedToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const header = base64url(encoder.encode(JSON.stringify({ alg: "none", typ: "JWT" })));
  const payload = base64url(
    encoder.encode(JSON.stringify({ sub: ADMIN_EMAIL, iss: ISSUER, iat: now, exp: now + 3600 })),
  );
  const signature = base64url(encoder.encode("not-a-signature"));
  return `${header}.${payload}.${signature}`;
}

export function shapedToken(): string {
  const encoder = new TextEncoder();
  const part = (value: string) => base64url(encoder.encode(value));
  return `${part('{"alg":"HS256"}')}.${part('{"sub":"a"}')}.${part("sig")}`;
}
