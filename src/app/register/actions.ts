"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { registerByIp, registerGlobal } from "@/lib/auth/rateLimit";
import { registrationOpen } from "@/lib/auth/registration";
import { clientIp } from "@/lib/http/clientIp";

export type RegisterState =
  | { error: "email" | "password" | "mismatch" | "rate_limited" | "closed"; retryAfterSec?: number }
  | undefined;

// WHY: same shape and limits as the admin createUser action.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 1024;

/**
 * Self sign-up. Contract: input email/password/confirm; output a redirect to /login?registered=1, or { error }.
 * WHY: the role is fixed to viewer here and never read from the form, so a crafted POST cannot ask for more.
 * WHY: a new account and an existing email end in the same redirect after the same scrypt work, so the
 * response does not reveal which emails have accounts (no enumeration); the user then signs in normally.
 */
export async function register(_prev: RegisterState, form: FormData): Promise<RegisterState> {
  // WHY: a Server Action is a public POST endpoint, so hiding the page is not enough; refuse before any work.
  if (!registrationOpen()) return { error: "closed" };
  const rawEmail = form.get("email");
  const password = form.get("password");
  const confirm = form.get("confirm");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return { error: "email" };
  if (typeof password !== "string" || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return { error: "password" };
  }
  if (password !== confirm) return { error: "mismatch" };

  // WHY: limit after the cheap checks (typos do not burn the quota) and before the DB and scrypt.
  const ip = clientIp(await headers());
  // WHY: check in order and stop at the first refusal; a client already refused per IP must not also
  // spend the shared global quota (that would let one blocked client lock sign-up for everyone).
  const byIp = registerByIp.hit(ip ?? "unknown");
  if (!byIp.ok) return { error: "rate_limited", retryAfterSec: byIp.retryAfterSec };
  const global = registerGlobal.hit("all");
  if (!global.ok) return { error: "rate_limited", retryAfterSec: global.retryAfterSec };

  const passwordHash = await hashPassword(password);
  try {
    // WHY: on conflict do nothing instead of catching 23505, so the duplicate path does the same work and
    // returns the same way as the new-account path.
    const { rows } = await db.query(
      "insert into users (email, password_hash, role) values ($1, $2, 'viewer') on conflict (email) do nothing returning id",
      [email, passwordHash],
    );
    const id = (rows[0] as { id: string } | undefined)?.id;
    if (id) {
      // WHY: ids and ip only, never the email (same rule as the admin audit rows).
      await db.query("insert into admin_audit (actor_id, action, target, ip) values ($1, 'user.register', $2, $3)", [
        id,
        `user:${id}`,
        ip,
      ]);
    }
  } catch (e) {
    console.error("[auth/register] failed:", e instanceof Error ? e.message : "unknown");
    throw new Error("Sign-up unavailable");
  }

  // WHY: redirect() throws; keep it outside try/catch so it is not swallowed.
  redirect("/login?registered=1");
}
