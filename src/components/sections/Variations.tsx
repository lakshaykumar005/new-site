import { variationsCopy } from "@/content/copy";

// STUB — to be built (see docs/SPEC.md § Variations)
export default function Variations() {
  return (
    <section id="variations" className="section">
      <div className="wrap">
        <p className="t-kicker">{variationsCopy.kicker}</p>
        <h2 className="t-display mt-4">{variationsCopy.title}</h2>
      </div>
    </section>
  );
}
