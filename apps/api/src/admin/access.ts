import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { jwk } from "hono/jwk";
import "hono/jwt";
import { type ApiEnv, forbidden, internalError, unauthorized } from "../errors";

const ASSERTION = "Cf-Access-Jwt-Assertion";

function filled(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

function accessConfig(
  env: CloudflareBindings,
): { team: string; aud: string; email: string } | null {
  const team = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  const email = env.ADMIN_EMAIL;
  if (!filled(team) || !filled(aud) || !filled(email)) return null;
  return { team: team.trim(), aud: aud.trim(), email: email.trim() };
}

function requestWithBearer(request: Request): Request {
  const token = request.headers.get(ASSERTION);
  if (token === null || /^bearer\s+/i.test(token)) return request;
  const headers = new Headers(request.headers);
  headers.set(ASSERTION, `Bearer ${token}`);
  return new Request(request, { headers });
}

function emailFrom(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("email" in payload)) return null;
  return typeof payload.email === "string" ? payload.email : null;
}

async function sameText(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left.toLowerCase())),
    crypto.subtle.digest("SHA-256", encoder.encode(right.toLowerCase())),
  ]);
  return crypto.subtle.timingSafeEqual(new Uint8Array(leftHash), new Uint8Array(rightHash));
}

export const accessAuth = createMiddleware<ApiEnv>(async (c, next) => {
  const config = accessConfig(c.env);
  if (config === null) return c.json(internalError(), 500);

  c.req.raw = requestWithBearer(c.req.raw);
  let email: string | null = null;
  try {
    await jwk({
      headerName: ASSERTION,
      jwks_uri: `https://${config.team}/cdn-cgi/access/certs`,
      alg: ["RS256"],
      verification: { aud: config.aud },
    })(c, async () => {
      email = emailFrom(c.var.jwtPayload);
    });
  } catch (error) {
    if (error instanceof HTTPException && error.status === 401) return c.json(unauthorized(), 401);
    throw error;
  }

  if (email === null || !(await sameText(email, config.email))) return c.json(forbidden(), 403);
  return next();
});
