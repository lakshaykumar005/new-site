import type { Metadata } from "next";
import Epigraph from "@/components/chrome/Epigraph";
import Plates from "@/components/sections/Plates";
import ScorePage from "@/components/chrome/ScorePage";

export const metadata: Metadata = { title: "Plates" };

export default function Page() {
  return (
    <ScorePage slug="/plates">
      <Epigraph slot="plates" atHead />
      <Plates />
    </ScorePage>
  );
}
