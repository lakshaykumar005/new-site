import type { Metadata } from "next";
import Epigraph from "@/components/chrome/Epigraph";
import MusicBox from "@/components/sections/MusicBox";
import ScorePage from "@/components/chrome/ScorePage";

export const metadata: Metadata = { title: "The music box" };

export default function Page() {
  return (
    <ScorePage slug="/music-box">
      <Epigraph slot="musicBox" atHead />
      <MusicBox />
    </ScorePage>
  );
}
