import { requireUser, authErrorResponse } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/me/avatar — the signed-in user's own avatar (WebP bytes).
 * The page passes ?v=<avatar_updated_at ms>, so a new upload changes the URL and no cache ever
 * shows the previous picture. Cache is private: the avatar belongs to one account.
 */
export async function GET(request: Request): Promise<Response> {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    const denied = authErrorResponse(e);
    if (denied) return denied;
    return new Response("unavailable", { status: 503 });
  }

  const { rows } = await db.query(
    "select avatar_webp, avatar_updated_at from users where id = $1",
    [user.id],
  );
  const row = rows[0] as { avatar_webp: Buffer | null; avatar_updated_at: Date | string } | undefined;
  if (!row?.avatar_webp) return new Response("Not Found", { status: 404 });

  const version = new Date(row.avatar_updated_at).getTime();
  const etag = `"v${version}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(new Uint8Array(row.avatar_webp), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=86400",
      ETag: etag,
    },
  });
}
