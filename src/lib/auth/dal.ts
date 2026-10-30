import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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
  if ((RANK[user.role] ?? -1) < RANK[minRole]) throw new AuthError("forbidden");
  return user;
});

export function authErrorResponse(e: unknown): NextResponse | null {
  if (!(e instanceof AuthError)) return null;
  return e.code === "unauthenticated"
    ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
    : NextResponse.json({ error: "forbidden" }, { status: 403 });
}
