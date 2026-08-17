import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  SITE_DESCRIPTION,
  SITE_TAGLINE,
  SITE_TITLE,
  siteJsonLd,
} from "@/lib/agent-docs";
import { publicOrigin } from "@/lib/public-origin";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const origin = publicOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_TITLE}`,
  },
  description: `${SITE_TAGLINE} ${SITE_DESCRIPTION}`,
  applicationName: SITE_TITLE,
  keywords: [
    "askmeatsack.com",
    "MCP",
    "questionnaire",
    "agent",
    "human in the loop",
  ],
  authors: [{ name: SITE_TITLE, url: origin }],
  alternates: {
    canonical: "/",
    types: {
      "text/markdown": "/mcp.md",
      "text/plain": "/llms.txt",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: origin,
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: `${SITE_TAGLINE} ${SITE_DESCRIPTION}`,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: `${SITE_TAGLINE} ${SITE_DESCRIPTION}`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = siteJsonLd(origin);
  return (
    <html
      lang="en-GB"
      className={`${geist.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
