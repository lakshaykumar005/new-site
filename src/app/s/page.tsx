import type { Metadata } from "next";
import { arrived } from "@/content/copy";

export const metadata: Metadata = {
  title: arrived.kicker,
  robots: { index: false, follow: false },
};

// STUB — to be built (see docs/SPEC.md § Arrived)
export default function SongArrived() {
  return (
    <main className="section">
      <div className="wrap">
        <p className="t-kicker">{arrived.kicker}</p>
      </div>
    </main>
  );
}
