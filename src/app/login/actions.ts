"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, revokeSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { loginByEmail, loginByIp } from "@/lib/auth/rateLimit";
import { safeNext } from "@/lib/auth/safeNext";
import { clientIp } from "@/lib/http/clientIp";

export type SignInState = { error?: "invalid" | "rate_limited" } | undefined;

// WHY: well-formed hash (valid params, 16-byte salt, 64-byte key) so verifyPassword runs the full
// scrypt for unknown emails too; timing then does not reveal whether an account exists.
const DUMMY_HASH = `scrypt$131072$8$1$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const rawEmail = form.get("email");
  const password = form.get("password");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  // WHY: cap password length so one request cannot feed scrypt an arbitrarily large input.
  if (!email || email.length > 254 || typeof password !== "string" || !password || password.length > 1024) {
    return { error: "invalid" };
  }

  // WHY: limit before any DB lookup or scrypt, so brute force cannot cost us DB or 128 MiB hashes.
  if (!loginByIp.hit(clientIp(await headers()) ?? "unknown").ok || !loginByEmail.hit(email).ok) {
    return { error: "rate_limited" };
  }

  try {
    const { rows } = await db.query("select id, password_hash, disabled from users where email = $1", [email]);
    const u = rows[0] as { id: string; password_hash: string; disabled: boolean } | undefined;
    const ok = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
    // WHY: unknown email, wrong password and disabled account all look identical (no enumeration).
    if (!u || u.disabled || !ok) return { error: "invalid" };

    const { token, expiresAt } = await createSession(u.id);
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  } catch (e) {
    console.error("[auth/signIn] failed:", e);
    throw new Error("Sign-in unavailable");
  }

  const next = form.get("next");
  // WHY: redirect() throws; keep it outside try/catch so it is not swallowed.
  redirect(safeNext(typeof next === "string" ? next : null));
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(token);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
