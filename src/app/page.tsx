import Epigraph from "@/components/chrome/Epigraph";
import Cipher from "@/components/sections/Cipher";
import Coda from "@/components/sections/Coda";
import Frontispiece from "@/components/sections/Frontispiece";
import MusicBox from "@/components/sections/MusicBox";
import Plates from "@/components/sections/Plates";
import TitlePage from "@/components/sections/TitlePage";
import Variations from "@/components/sections/Variations";
import YourTurn from "@/components/sections/YourTurn";

export default function Home() {
  return (
    <main>
      <TitlePage />
      <Frontispiece />
      <Epigraph slot="cipher" />
      <Cipher />
      <Epigraph slot="musicBox" />
      <MusicBox />
      <Epigraph slot="variations" />
      <Variations />
      <Epigraph slot="plates" />
      <Plates />
      <Epigraph slot="yourTurn" />
      <YourTurn />
      <Epigraph slot="coda" />
      <Coda />
    </main>
  );
}
