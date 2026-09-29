import { titlePage } from "@/content/copy";
import { HER_NAME } from "@/content/site";

// STUB — to be built (see docs/SPEC.md § TitlePage)
export default function TitlePage() {
  return (
    <section id="top" className="section min-h-[100svh]">
      <div className="wrap text-center">
        <p className="t-kicker">{titlePage.eyebrow}</p>
        <h1 className="t-title text-7xl">{HER_NAME}</h1>
      </div>
    </section>
  );
}
