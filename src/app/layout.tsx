import type { Metadata, Viewport } from "next";
import { Newsreader, Noto_Serif_Bengali } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

// One serif family with optical sizes: tight display cuts for titles, open text cuts for reading.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

// Only for the product name নিয়ম.
const bengali = Noto_Serif_Bengali({
  variable: "--font-noto-serif-bengali",
  subsets: ["bengali"],
  weight: ["600"],
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "NIYOM — Be ready. Not just informed.",
    template: "%s · NIYOM",
  },
  description:
    "NIYOM tracks official notice revisions, ignores cosmetic edits, and tells you which of your prepared documents a corrigendum has invalidated.",
};

export const viewport: Viewport = {
  themeColor: "#f4f1ea",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${newsreader.variable} ${bengali.variable} h-full`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
