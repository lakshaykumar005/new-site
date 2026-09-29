import { cipher } from "@/content/copy";

// STUB — to be built (see docs/SPEC.md § Cipher)
export default function Cipher() {
  return (
    <section id="cipher" className="section">
      <div className="wrap">
        <p className="t-kicker">{cipher.kicker}</p>
        <h2 className="t-display mt-4">{cipher.title}</h2>
      </div>
    </section>
  );
}
