import { COVER_ALT, COVER_SIZE } from "@/components/sections/coda/coverMeta";

// The link preview: the cover of a first-edition score (see coda/cover.tsx).
export const alt = COVER_ALT;
export const size = COVER_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const { renderCover } = await import("@/components/sections/coda/cover");
  return renderCover();
}
