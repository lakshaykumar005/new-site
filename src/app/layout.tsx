import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, DM_Mono, Newsreader } from "next/font/google";
import RevealObserver from "@/components/chrome/RevealObserver";
import SoundToggle from "@/components/chrome/SoundToggle";
import { HER_NAME, SITE_DESCRIPTION, SITE_TITLE } from "@/content/site";
import "./globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-bodoni",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${SITE_TITLE} — for ${HER_NAME}`, template: `%s · ${SITE_TITLE}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: `${SITE_TITLE} — for ${HER_NAME}`,
    description: SITE_DESCRIPTION,
    type: "website",
    siteName: SITE_TITLE,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_TITLE} — for ${HER_NAME}`,
    description: SITE_DESCRIPTION,
  },
  // A private piece of music — not for search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f4eee3",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodoni.variable} ${newsreader.variable} ${dmMono.variable}`}>
      <body>
        <SoundToggle />
        {children}
        <RevealObserver />
      </body>
    </html>
  );
}
