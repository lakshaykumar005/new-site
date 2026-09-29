import { ViewTransition } from "react";
import { PAGES } from "@/content/pages";
import PageTurn from "./PageTurn";

/**
 * One page of the score. Turning forward slides it away to the left,
 * turning back slides it away to the right — like paper.
 */
export default function ScorePage({ slug, children }: { slug: string; children: React.ReactNode }) {
  const index = PAGES.findIndex((p) => p.slug === slug);
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <main className="flex min-h-[100svh] flex-col" data-page={slug}>
        <div className="flex-1">{children}</div>
        {index >= 0 && <PageTurn index={index} />}
      </main>
    </ViewTransition>
  );
}
