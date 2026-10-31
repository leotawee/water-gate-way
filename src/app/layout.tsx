import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

// WHY: Plex Sans Thai covers the Thai UI copy and Latin; Plex Mono keeps numeric readings aligned.
const plexSans = IBM_Plex_Sans_Thai({
  variable: "--font-plex-sans",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Water Gate 1 — Irrigation Department Dashboard",
  description:
    "Real-time water management dashboard for monitoring water levels, pump controls, and 3-phase electrical systems.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${plexSans.variable} ${plexMono.variable} antialiased`}>
      <body className="min-h-dvh bg-bg font-sans text-fg">{children}</body>
    </html>
  );
}
