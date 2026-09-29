import type { Metadata, ResolvingMetadata } from "next";
import Arrived from "@/components/sections/Arrived";
import { arrived } from "@/content/copy";

/**
 * The link preview in a chat says what this is — a song has arrived —
 * and gives nothing of the word away. Metadata merges shallowly, so the
 * site's own Open Graph and card fields (its preview image among them)
 * are carried over from the root and only the words are replaced.
 */
export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  const site = await parent;
  return {
    title: arrived.kicker,
    description: arrived.title,
    openGraph: {
      title: arrived.kicker,
      description: arrived.title,
      type: "website",
      siteName: site.openGraph?.siteName ?? undefined,
      locale: site.openGraph?.locale ?? undefined,
      images: site.openGraph?.images,
    },
    twitter: {
      card: "summary_large_image",
      title: arrived.kicker,
      description: arrived.title,
      images: site.twitter?.images,
    },
    robots: { index: false, follow: false },
  };
}

/**
 * Where a sent song lands. The word lives in the link's #hash, which
 * never reaches the server — everything here happens in the browser.
 */
export default function SongArrived() {
  return <Arrived />;
}
