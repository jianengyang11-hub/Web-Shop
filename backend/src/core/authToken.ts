import { sign, verify } from "hono/jwt";

const EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AuthPayload {
  tenantId: string;
  exp: number;
  [key: string]: unknown;
}

export async function signAuthToken(tenantId: string, secret: string): Promise<string> {
  const payload: AuthPayload = {
    tenantId,
    exp: Math.floor(Date.now() / 1000) + EXPIRY_SECONDS,
  };
  return sign(payload, secret, "HS256");
}

/** Throws if the token is missing, malformed, expired, or signed with a different secret. */
export async function verifyAuthToken(token: string, secret: string): Promise<AuthPayload> {
  const payload = await verify(token, secret, "HS256");
  return payload as unknown as AuthPayload;
}
