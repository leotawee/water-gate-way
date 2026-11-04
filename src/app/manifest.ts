import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Water Gate Way",
    short_name: "Water Gate Way",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f2",
    // WHY: the installed PWA's title bar is chrome, and chrome is brand navy (DESIGN.md) —
    // same value as the viewport themeColor in layout.tsx, so browser and PWA agree.
    theme_color: "#202068",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
