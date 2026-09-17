import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Hanken_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { record } from "@/content/record";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const SITE_URL = "https://www.kartikey.fyi";
const TITLE = `${record.owner.name} · ${record.owner.role}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s · ${record.owner.name}`,
  },
  description: record.owner.tagline,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "kartikey.fyi",
    title: TITLE,
    description: record.owner.tagline,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: record.owner.tagline,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#070b16",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${hanken.variable} ${dmMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
