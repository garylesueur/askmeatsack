import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_DESCRIPTION, SITE_TAGLINE, SITE_TITLE, siteJsonLd } from "@/lib/agent-docs";
import { ColorSchemeSync } from "@/components/color-scheme-sync";
import { publicOrigin } from "@/lib/public-origin";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const SYSTEM_DARK_SCRIPT = `(function(){var mode;try{mode=localStorage.getItem("askmeatsack:color-mode");}catch(e){}var dark=mode==="dark"||(mode!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;if(mode==="light"||mode==="dark")root.dataset.colorMode=mode;root.classList.toggle("dark",dark);root.style.colorScheme=dark?"dark":"light";})();`;

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
    default: `${SITE_TITLE} · I, Meatsack`,
    template: `%s · ${SITE_TITLE} · I, Meatsack`,
  },
  description: `${SITE_TAGLINE} ${SITE_DESCRIPTION}`,
  applicationName: SITE_TITLE,
  keywords: [
    "I, Meatsack",
    "ask.imeatsack.com",
    "MCP",
    "questionnaire",
    "agent",
    "human in the loop",
  ],
  authors: [{ name: "Gary Le Sueur", url: "https://gaz.dev" }],
  alternates: {
    canonical: "/",
    types: {
      "text/markdown": "/index.md",
      "text/plain": "/llms.txt",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: origin,
    siteName: "I, Meatsack",
    title: `${SITE_TITLE} · I, Meatsack`,
    description: `${SITE_TAGLINE} ${SITE_DESCRIPTION}`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_TITLE} · I, Meatsack`,
    description: `${SITE_TAGLINE} ${SITE_DESCRIPTION}`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
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
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <script dangerouslySetInnerHTML={{ __html: SYSTEM_DARK_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ColorSchemeSync />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
