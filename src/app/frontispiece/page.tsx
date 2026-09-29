import type { Metadata } from "next";
import Frontispiece from "@/components/sections/Frontispiece";
import ScorePage from "@/components/chrome/ScorePage";

export const metadata: Metadata = { title: "Frontispiece" };

export default function Page() {
  return (
    <ScorePage slug="/frontispiece">
      <Frontispiece />
    </ScorePage>
  );
}
