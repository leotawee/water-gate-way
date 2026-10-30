// CSRF: the browser sets Origin and Host; a cross-site page cannot forge either without a CORS preflight.
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  if (origin === new URL(req.url).origin) return true;
  // WHY: nginx terminates TLS, so req.url may say http://upstream while the browser says https://public.
  const first = (v: string | null) => v?.split(",")[0]?.trim();
  const proto = first(req.headers.get("x-forwarded-proto"));
  const host = first(req.headers.get("x-forwarded-host")) || first(req.headers.get("host"));
  return !!proto && !!host && origin === `${proto}://${host}`;
}
