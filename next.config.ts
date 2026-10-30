import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// TECH DEBT: 'unsafe-inline' for scripts (Next inlines bootstrap/RSC payload scripts) until a nonce-based CSP is wired.
// WHY 'unsafe-eval' in dev only: React refresh / HMR evals code; never allowed in production.
// WHY https://unpkg.com in img-src: WaterGateMap loads the Leaflet marker PNGs from unpkg.
// Fix: vendor them into /public and drop this host.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: https://*.tile.openstreetmap.org https://unpkg.com",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
