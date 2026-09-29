import type { Metadata } from "next";
import Epigraph from "@/components/chrome/Epigraph";
import Cipher from "@/components/sections/Cipher";
import ScorePage from "@/components/chrome/ScorePage";

export const metadata: Metadata = { title: "The cipher" };

export default function Page() {
  return (
    <ScorePage slug="/cipher">
      <Epigraph slot="cipher" atHead />
      <Cipher />
    </ScorePage>
  );
}
