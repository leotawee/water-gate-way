import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, SESSION_COOKIE, type SessionUser } from "./session";

type Role = SessionUser["role"];
const RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

export class AuthError extends Error {
  constructor(readonly code: "unauthenticated" | "forbidden") {
    super(code);
    this.name = "AuthError";
  }
}

// WHY: the real auth check (proxy.ts only looks for the cookie). cache() dedupes per request.
export const getUser = cache(async (): Promise<SessionUser | null> => {
  return getSessionUser((await cookies()).get(SESSION_COOKIE)?.value);
});

export const requireUser = cache(async (minRole: Role = "viewer"): Promise<SessionUser> => {
  const user = await getUser();
  if (!user) throw new AuthError("unauthenticated");
  // WHY: unknown role strings from the DB rank below viewer, so they fail closed.
  // WHY: an unknown minRole (typo, cast) ranks above admin, so the check denies instead of passing.
  if ((RANK[user.role] ?? -1) < (RANK[minRole] ?? Infinity)) throw new AuthError("forbidden");
  return user;
});

/** For server-component pages: unauthenticated -> redirect to /login?next=<next>; other errors rethrow. */
export async function requirePageUser(next: string): Promise<SessionUser> {
  let user: SessionUser | null = null;
  try {
    user = await requireUser();
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
  }
  // WHY: redirect() throws; Next requires it outside the try block.
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/**
 * For admin pages: unauthenticated -> redirect to /login; logged in but not admin -> notFound().
 * WHY: a 404 for non-admins does not reveal that /admin exists.
 */
export async function requireAdminPage(next: string): Promise<SessionUser> {
  let user: SessionUser | null = null;
  try {
    user = await requireUser("admin");
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    if (e.code === "forbidden") notFound();
  }
  // WHY: redirect() and notFound() throw; both stay outside the try block.
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export function authErrorResponse(e: unknown): NextResponse | null {
  if (!(e instanceof AuthError)) return null;
  return e.code === "unauthenticated"
    ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
    : NextResponse.json({ error: "forbidden" }, { status: 403 });
}
