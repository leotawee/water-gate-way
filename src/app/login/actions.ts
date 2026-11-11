"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import { createSession, revokeSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { issueRememberToken, REMEMBER_COOKIE, rememberCookieOptions, revokeRememberToken } from "@/lib/auth/remember";
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
  // WHY: missing or non-IP proxy headers share one "unknown" bucket; that can throttle those clients
  // together, but rotating garbage X-Forwarded-For values no longer yields a fresh bucket per attempt.
  // WHY per-(ip,email) key on the email bucket: a plain email key lets 5 wrong passwords from one IP
  // lock the victim's login for 15 minutes, renewable forever (audit 2026-11-11, login-lockout-dos).
  const ip = clientIp(await headers()) ?? "unknown";
  if (!loginByIp.hit(ip).ok || !loginByEmail.hit(`${ip}|${email}`).ok) {
    return { error: "rate_limited" };
  }

  try {
    const { rows } = await db.query("select id, password_hash, disabled from users where email = $1", [email]);
    const u = rows[0] as { id: string; password_hash: string; disabled: boolean } | undefined;
    const ok = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
    // WHY: unknown email, wrong password and disabled account all look identical (no enumeration).
    if (!u || u.disabled || !ok) {
      // WHY its own try: a failed audit row must never turn an auth outcome into a 500.
      try {
        await db.query(
          "insert into action_audit (user_id, action, detail, ip) values ($1, 'login.fail', $2, $3)",
          [u?.id ?? null, u?.disabled ? "disabled" : "invalid_credentials", clientIp(await headers())],
        );
      } catch {
        console.error("[auth/signIn] audit failed");
      }
      return { error: "invalid" };
    }

    const { token, expiresAt } = await createSession(u.id);
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));

    try {
      await db.query("insert into action_audit (user_id, action, ip) values ($1, 'login.ok', $2)", [
        u.id,
        clientIp(await headers()),
      ]);
    } catch {
      console.error("[auth/signIn] audit failed");
    }

    // WHY: its own try: a failed issue (e.g. migration not applied) must not block a correct login.
    if (form.get("remember") === "on") {
      try {
        const remember = await issueRememberToken(u.id, (await headers()).get("user-agent"));
        (await cookies()).set(REMEMBER_COOKIE, remember.value, rememberCookieOptions(remember.expiresAt));
      } catch {
        console.error("[auth/signIn] remember token failed");
      }
    }

    // WHY: the password is verified right now, so this is the only moment to upgrade a legacy bcrypt row to scrypt.
    // WHY: its own try: a failed upgrade must not block a correct login (the row stays bcrypt and retries next time).
    if (needsRehash(u.password_hash)) {
      try {
        await db.query("update users set password_hash = $1 where id = $2", [await hashPassword(password), u.id]);
      } catch {
        console.error("[auth/signIn] rehash failed");
      }
    }
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
  if (token) {
    // WHY: audit before revoke, so the session row still names the user. Its own try: a failed
    // audit row must never block signing out.
    try {
      await db.query(
        "insert into action_audit (user_id, action, ip) select user_id, 'logout', $2::inet from sessions where token_hash = encode(digest($1, 'sha256'), 'raw')",
        [token, clientIp(await headers())],
      );
    } catch {
      console.error("[auth/signOut] audit failed");
    }
    await revokeSession(token);
  }
  // WHY: its own try: a broken remember store must not leave the browser holding an undeletable cookie set.
  try {
    await revokeRememberToken(store.get(REMEMBER_COOKIE)?.value);
  } catch {
    console.error("[auth/signOut] remember revoke failed");
  }
  store.delete(SESSION_COOKIE);
  store.delete(REMEMBER_COOKIE);
  redirect("/login");
}
