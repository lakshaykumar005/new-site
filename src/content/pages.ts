// The pages of the score, in reading order. Each one is its own route;
// the page turner, the contents and the swipe gestures all follow this list.

export interface ScorePageInfo {
  slug: string;
  /** as printed in the contents and the page turner */
  title: string;
  /** small label beside the title in the contents */
  label?: string;
}

export const PAGES: readonly ScorePageInfo[] = [
  { slug: "/", title: "Title page" },
  { slug: "/frontispiece", title: "Frontispiece" },
  { slug: "/cipher", title: "The cipher" },
  { slug: "/music-box", title: "The music box" },
  { slug: "/variations", title: "Variations" },
  { slug: "/plates", title: "Plates" },
  { slug: "/your-turn", title: "Your turn" },
  { slug: "/coda", title: "Coda" },
];

export function pageIndex(pathname: string): number {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return PAGES.findIndex((p) => p.slug === clean);
}

export const pagesCopy = {
  contents: "Contents",
  contentsOpen: "Open the contents",
  contentsClose: "Close the contents",
  subtitle: "Variations on a Name",
  here: "you are here",
  back: "Turn back",
  next: "Turn the page",
  swipeHint: "or swipe",
  pageWord: "page",
  end: "Fine",
};
