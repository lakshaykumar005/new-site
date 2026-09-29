// The pages of the score, in reading order. Each one is its own route;
// the page turner, the contents and the swipe gestures all follow this list.

export interface ScorePageInfo {
  slug: string;
  /** as printed in the contents and the page turner */
  title: string;
  /** small label beside the title in the contents ("Fig. 1") */
  label?: string;
}

export const PAGES: readonly ScorePageInfo[] = [
  { slug: "/", title: "Title page" },
  { slug: "/frontispiece", title: "Frontispiece" },
  { slug: "/cipher", title: "The cipher", label: "Fig. 1" },
  { slug: "/music-box", title: "The music box", label: "Fig. 2" },
  { slug: "/variations", title: "Variations", label: "Fig. 3" },
  { slug: "/plates", title: "Plates" },
  { slug: "/your-turn", title: "Your turn", label: "Fig. 4" },
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
