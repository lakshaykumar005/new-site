import type { Metadata } from "next";
import Epigraph from "@/components/chrome/Epigraph";
import Coda from "@/components/sections/Coda";
import ScorePage from "@/components/chrome/ScorePage";

export const metadata: Metadata = { title: "Coda" };

export default function Page() {
  return (
    <ScorePage slug="/coda">
      <Epigraph slot="coda" atHead />
      <Coda />
    </ScorePage>
  );
}
