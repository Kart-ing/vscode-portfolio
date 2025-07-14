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
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
