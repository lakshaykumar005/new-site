import { yourTurn } from "@/content/copy";

// STUB — to be built (see docs/SPEC.md § YourTurn)
export default function YourTurn() {
  return (
    <section id="your-turn" className="section">
      <div className="wrap">
        <p className="t-kicker">{yourTurn.kicker}</p>
        <h2 className="t-display mt-4">{yourTurn.title}</h2>
      </div>
    </section>
  );
}
