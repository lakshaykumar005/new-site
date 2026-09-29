import type { Metadata } from "next";
import Epigraph from "@/components/chrome/Epigraph";
import Variations from "@/components/sections/Variations";
import ScorePage from "@/components/chrome/ScorePage";

export const metadata: Metadata = { title: "Variations" };

export default function Page() {
  return (
    <ScorePage slug="/variations">
      <Epigraph slot="variations" atHead />
      <Variations />
    </ScorePage>
  );
}
