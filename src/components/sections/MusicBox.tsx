import { musicBoxCopy } from "@/content/copy";

// STUB — to be built (see docs/SPEC.md § MusicBox)
export default function MusicBox() {
  return (
    <section id="music-box" className="section">
      <div className="wrap">
        <p className="t-kicker">{musicBoxCopy.kicker}</p>
        <h2 className="t-display mt-4">{musicBoxCopy.title}</h2>
      </div>
    </section>
  );
}
