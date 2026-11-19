import { env } from "cloudflare:workers";
import { sign } from "hono/jwt";
import type { HonoJsonWebKey } from "hono/utils/jwt/jws";
import type { JWTPayload } from "hono/utils/jwt/types";

const TEAM = "access.test";
export const AUD = "aud-tag";
const ADMIN = "yashira@example.com";

type Pair = { privateKey: HonoJsonWebKey; publicKey: HonoJsonWebKey };

function webKey(value: ArrayBuffer | JsonWebKey): JsonWebKey {
  if (value instanceof ArrayBuffer) throw new Error("expected jwk");
  return value;
}

async function generatePair(kid: string): Promise<Pair> {
  const key = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  if (!("privateKey" in key)) throw new Error("expected key pair");
  const exportedPrivate = webKey(await crypto.subtle.exportKey("jwk", key.privateKey));
  const exportedPublic = webKey(await crypto.subtle.exportKey("jwk", key.publicKey));
  const n = exportedPublic.n;
  const e = exportedPublic.e;
  if (n === undefined || e === undefined) throw new Error("incomplete jwk");
  return {
    privateKey: { ...exportedPrivate, alg: "RS256", kid },
    publicKey: { kty: exportedPublic.kty, n, e, alg: "RS256", kid, use: "sig" },
  };
}

export const accessPairs = Promise.all([generatePair("test-key"), generatePair("other-key")]);

let fetches = 0;
let restoreFetch = (): void => {};

export function certFetches(): number {
  return fetches;
}

export function installJwks(publicKey: HonoJsonWebKey): void {
  const real = globalThis.fetch;
  fetches = 0;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      input instanceof Request ? input.url : input instanceof URL ? input.href : String(input);
    if (url !== `https://${TEAM}/cdn-cgi/access/certs`) {
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    }
    fetches += 1;
    void init;
    return Promise.resolve(
      new Response(JSON.stringify({ keys: [publicKey] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  };
  restoreFetch = () => {
    globalThis.fetch = real;
  };
}

export function restoreAccessFetch(): void {
  restoreFetch();
}

export function claims(overrides: JWTPayload = {}): JWTPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    aud: [AUD],
    email: ADMIN,
    exp: now + 3600,
    nbf: now - 60,
    iat: now - 60,
    iss: `https://${TEAM}`,
    sub: "admin-user",
    type: "app",
    ...overrides,
  };
}

export async function goodToken(overrides: JWTPayload = {}): Promise<string> {
  const [good] = await accessPairs;
  if (good === undefined) throw new Error("missing key");
  return sign(claims(overrides), good.privateKey);
}

export function bindings(
  overrides: { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; ADMIN_EMAIL?: string } = {},
) {
  return {
    DB: env.DB,
    FILES: env.FILES,
    ACCESS_TEAM_DOMAIN: overrides.ACCESS_TEAM_DOMAIN ?? TEAM,
    ACCESS_AUD: overrides.ACCESS_AUD ?? AUD,
    ADMIN_EMAIL: overrides.ADMIN_EMAIL ?? ADMIN,
  };
}
