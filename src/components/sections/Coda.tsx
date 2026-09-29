import { coda } from "@/content/copy";

// STUB — to be built (see docs/SPEC.md § Coda)
export default function Coda() {
  return (
    <section id="coda" className="section">
      <div className="wrap">
        <p className="t-kicker">{coda.kicker}</p>
        <h2 className="t-display mt-4">{coda.title}</h2>
      </div>
    </section>
  );
}
