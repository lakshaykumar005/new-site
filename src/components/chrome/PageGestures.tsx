"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PAGES, pageIndex } from "@/content/pages";

const INTERACTIVE = "input, textarea, select, [contenteditable], [data-noswipe], dialog[open]";

/** Does this element (or an ancestor) take horizontal touch gestures for itself? */
function ownsGestures(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const ta = getComputedStyle(n).touchAction;
    if (ta === "none" || (ta.includes("pan-y") && !ta.includes("pan-x"))) return true;
  }
  return false;
}

/**
 * Turn pages like paper: a decisive horizontal swipe on a phone, or
 * ← / → on a keyboard. Anything that takes horizontal gestures itself
 * (the music box's handle and paper, via touch-action) is left alone,
 * as is anything marked `data-noswipe`.
 */
export default function PageGestures() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const here = pageIndex(pathname);
    if (here < 0) return;

    const go = (delta: number) => {
      const to = PAGES[here + delta];
      if (!to) return;
      router.push(to.slug, { transitionTypes: [delta > 0 ? "nav-forward" : "nav-back"] });
    };

    // prefetch the neighbours so a turn is instant
    if (PAGES[here + 1]) router.prefetch(PAGES[here + 1].slug);
    if (PAGES[here - 1]) router.prefetch(PAGES[here - 1].slug);

    let sx = 0;
    let sy = 0;
    let st = 0;
    let armed = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        armed = false;
        return;
      }
      const t = e.target as Element | null;
      armed = !t?.closest(INTERACTIVE) && !ownsGestures(t);
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      st = performance.now();
    };

    const onEnd = (e: TouchEvent) => {
      if (!armed) return;
      armed = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const dt = performance.now() - st;
      if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 2 && dt < 650) go(dx < 0 ? 1 : -1);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const t = e.target as Element | null;
      if (t && t !== document.body && t.closest(`${INTERACTIVE}, [role="slider"], [role="application"]`)) return;
      e.preventDefault();
      go(e.key === "ArrowRight" ? 1 : -1);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("keydown", onKey);
    };
  }, [pathname, router]);

  return null;
}
