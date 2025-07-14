import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AvatarGuide from "@/components/ui/AvatarGuide";
import SEOContent from "@/components/seo/SEOContent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kartikey Pandey - AR Developer & Software Engineer Portfolio",
  description: "AR Developer at Snap Inc. with $50,000+ in secured funding, 8x hackathon winner, and experience leading Penn State's competitive programming team. Interactive VS Code-themed portfolio showcasing AR projects and achievements.",
  keywords: ["AR Developer", "Software Engineer", "Snap Inc", "Augmented Reality", "Unity", "React", "Next.js", "Hackathon Winner", "Penn State"],
  authors: [{ name: "Kartikey Pandey" }],
  creator: "Kartikey Pandey",
  openGraph: {
    title: "Kartikey Pandey - AR Developer Portfolio",
    description: "AR Developer at Snap Inc. with $50,000+ in secured funding and 8x hackathon wins",
    type: "website",
    url: "https://yourdomain.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kartikey Pandey - AR Developer Portfolio",
    description: "AR Developer at Snap Inc. with $50,000+ in secured funding and 8x hackathon wins",
  },
  alternates: {
    canonical: "https://yourdomain.com",
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
    "jobTitle": "AR Developer & Software Engineer",
    "worksFor": {
      "@type": "Organization",
      "name": "Snap Inc."
    },
    "description": "AR Developer at Snap Inc. with $50,000+ in secured funding, 8x hackathon winner, and experience leading Penn State's competitive programming team.",
    "email": "kartikeypandey.official@gmail.com",
    "url": "https://yourdomain.com",
    "sameAs": [
      "https://linkedin.com/in/kartikeypandey",
      "https://github.com/Kart-ing"
    ],
    "knowsAbout": [
      "Augmented Reality",
      "Unity",
      "React",
      "Next.js",
      "JavaScript",
      "TypeScript",
      "Python",
      "Java",
      "C++"
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
