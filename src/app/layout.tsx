import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AvatarGuide from "@/components/ui/AvatarGuide";
import SEOContent from "@/components/seo/SEOContent";
import {
  GITHUB_URL,
  HACKATHON_WINNER,
  KARTS_DESCRIPTION,
  LINKEDIN_URL,
  ROLE,
  SITE_URL,
} from "@/lib/profile";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Kartikey Pandey — Founder, Karts",
  description: `Kartikey Pandey — ${ROLE}. ${HACKATHON_WINNER}.`,
  keywords: ["Kartikey Pandey", "Karts", "Founder", "Hackathon Winner"],
  authors: [{ name: "Kartikey Pandey" }],
  creator: "Kartikey Pandey",
  openGraph: {
    title: "Kartikey Pandey — Founder, Karts",
    description: `Kartikey Pandey — ${ROLE}. ${HACKATHON_WINNER}.`,
    type: "website",
    url: SITE_URL,
    siteName: "Kartikey Pandey",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Kartikey Pandey — Founder, Karts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kartikey Pandey — Founder, Karts",
    description: `Kartikey Pandey — ${ROLE}. ${HACKATHON_WINNER}.`,
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Kartikey Pandey",
    "jobTitle": ROLE,
    "worksFor": {
      "@type": "Organization",
      "name": "Karts"
    },
    "description": `${ROLE}. ${KARTS_DESCRIPTION} ${HACKATHON_WINNER}.`,
    "url": SITE_URL,
    "sameAs": [
      LINKEDIN_URL,
      GITHUB_URL
    ]
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
          <AvatarGuide />
          <SEOContent />
        </ThemeProvider>
      </body>
    </html>
  );
}
