import Divider from "@/components/chrome/Divider";
import Cipher from "@/components/sections/Cipher";
import Coda from "@/components/sections/Coda";
import MusicBox from "@/components/sections/MusicBox";
import TitlePage from "@/components/sections/TitlePage";
import Variations from "@/components/sections/Variations";
import YourTurn from "@/components/sections/YourTurn";

export default function Home() {
  return (
    <main>
      <TitlePage />
      <Cipher />
      <Divider />
      <MusicBox />
      <Divider />
      <Variations />
      <Divider />
      <YourTurn />
      <Divider />
      <Coda />
    </main>
  );
}
