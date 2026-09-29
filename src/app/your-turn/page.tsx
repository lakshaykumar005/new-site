import type { Metadata } from "next";
import Epigraph from "@/components/chrome/Epigraph";
import YourTurn from "@/components/sections/YourTurn";
import ScorePage from "@/components/chrome/ScorePage";

export const metadata: Metadata = { title: "Your turn" };

export default function Page() {
  return (
    <ScorePage slug="/your-turn">
      <Epigraph slot="yourTurn" atHead />
      <YourTurn />
    </ScorePage>
  );
}
