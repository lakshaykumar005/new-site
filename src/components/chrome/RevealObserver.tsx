"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Adds `.is-visible` to every `.reveal` element as it scrolls into
 * view (once). Watches the DOM so late-mounted sections are covered.
 */
export default function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
    );

    const scan = () => {
      document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };

    // a keyboard can reach a control before its block has scrolled far enough in
    const onFocus = (e: FocusEvent) => {
      for (let n = e.target as Element | null; n; n = n.parentElement) {
        if (n.classList?.contains("reveal")) n.classList.add("is-visible");
      }
    };

    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocus);
    return () => {
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("focusin", onFocus);
    };
  }, [pathname]);

  return null;
}
