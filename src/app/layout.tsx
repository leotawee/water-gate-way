import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ViewTransition } from "react";
import "./globals.css";

// WHY: LINE Seed Sans TH is the one family for the whole UI; 400 covers body copy, 700 headings and values.
const lineSeed = localFont({
  src: [
    { path: "./fonts/LINESeedSansTH_Rg.otf", weight: "400" },
    { path: "./fonts/LINESeedSansTH_Bd.otf", weight: "700" },
  ],
  variable: "--font-line-seed",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s · Water Gate Way",
    default: "Water Gate Way",
  },
  description: "ระบบติดตามระดับน้ำ ควบคุมปั๊ม และกล้อง สำหรับประตูน้ำชลประทาน",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#202068",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${lineSeed.variable} antialiased`}>
      <body className="min-h-dvh bg-bg font-sans text-fg">
        {/* WHY: route changes crossfade instead of cutting — the browser interpolates the swap,
            so shared chrome (headers) stays put and client state is not sacrificed for motion. */}
        <ViewTransition>{children}</ViewTransition>
      </body>
    </html>
  );
}
