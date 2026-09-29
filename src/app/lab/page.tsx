"use client";

import ScoreLine from "@/components/notation/ScoreLine";
import { compose, VARIATION_ORDER } from "@/lib/music/compose";
import { HER_NAME } from "@/content/site";

// temporary: engraving check — removed before shipping
export default function Lab() {
  return (
    <main className="wrap py-16 space-y-10">
      {VARIATION_ORDER.map((id) => {
        const score = compose(HER_NAME, id);
        return (
          <section key={id}>
            <p className="t-kicker">{id} · {score.bars.map((b) => b.chord).join(" ")} · {score.time.join("/")} · {score.length} beats</p>
            <ScoreLine score={score} width={680} letters="both" />
          </section>
        );
      })}
    </main>
  );
}
