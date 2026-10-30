import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export type SessionUser = { id: string; email: string; role: "viewer" | "operator" | "admin" };

export const SESSION_COOKIE = "wg_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // matches cookie max age

// WHY: store only sha256(token) so a DB leak does not yield usable session tokens.
const hashToken = (token: string) => createHash("sha256").update(token).digest();

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.query("insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)", [
    userId,
    hashToken(token),
    expiresAt,
  ]);
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const { rows } = await db.query(
    `select u.id, u.email, u.role
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > $2 and not u.disabled`,
    [hashToken(token), new Date()],
  );
  return (rows[0] as SessionUser | undefined) ?? null;
}

export async function revokeSession(token: string): Promise<void> {
  await db.query("delete from sessions where token_hash = $1", [hashToken(token)]);
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  };
}
