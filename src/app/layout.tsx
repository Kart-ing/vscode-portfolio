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
  title: "Kartikey Pandey - Founding Engineer & Software Engineer Portfolio",
  description: "Founding Engineer @ Raya Health (HF0 W26). Full-stack & ML engineer, 10x hackathon winner, ex-NASA Lunar Autonomy Challenge & ex-Intel. Interactive VS Code-themed portfolio showcasing projects, research, and achievements.",
  keywords: ["Founding Engineer", "Software Engineer", "Full-Stack Developer", "Machine Learning", "Raya Health", "HF0", "NASA", "Intel", "React", "Next.js", "TypeScript", "Python", "Hackathon Winner", "Penn State"],
  authors: [{ name: "Kartikey Pandey" }],
  creator: "Kartikey Pandey",
  openGraph: {
    title: "Kartikey Pandey - Founding Engineer Portfolio",
    description: "Founding Engineer @ Raya Health (HF0 W26) · 10x hackathon winner · ex-NASA & ex-Intel · full-stack + ML.",
    type: "website",
    url: "https://yourdomain.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kartikey Pandey - Founding Engineer Portfolio",
    description: "Founding Engineer @ Raya Health (HF0 W26) · 10x hackathon winner · ex-NASA & ex-Intel · full-stack + ML.",
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
    "jobTitle": "Founding Engineer",
    "worksFor": {
      "@type": "Organization",
      "name": "Raya Health"
    },
    "alumniOf": {
      "@type": "CollegeOrUniversity",
      "name": "Pennsylvania State University"
    },
    "description": "Founding Engineer @ Raya Health (HF0 W26). Full-stack and machine-learning engineer, 10x hackathon winner, ex-NASA Lunar Autonomy Challenge and ex-Intel.",
    "email": "kartikeypandey.official@gmail.com",
    "url": "https://yourdomain.com",
    "sameAs": [
      "https://linkedin.com/in/kartikeypandey2004",
      "https://github.com/Kart-ing"
    ],
    "knowsAbout": [
      "Software Engineering",
      "Full-Stack Development",
      "Machine Learning",
      "Computer Vision",
      "React",
      "Next.js",
      "TypeScript",
      "Python",
      "Node.js",
      "Augmented Reality"
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
