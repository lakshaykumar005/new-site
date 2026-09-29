import type { MetadataRoute } from "next";

/**
 * A private piece of music: no crawler is welcome. The only exceptions are
 * the fetchers that draw a link's preview card (some honour robots.txt, and
 * without them the cover wouldn't show when the link is sent). The pages
 * themselves still say noindex, nofollow (see layout.tsx).
 */
const LINK_PREVIEWS = [
  "facebookexternalhit",
  "Facebot",
  "WhatsApp",
  "Twitterbot",
  "TelegramBot",
  "Slackbot-LinkExpanding",
  "LinkedInBot",
  "Discordbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: LINK_PREVIEWS, allow: "/" },
      { userAgent: "*", disallow: "/" },
    ],
  };
}
