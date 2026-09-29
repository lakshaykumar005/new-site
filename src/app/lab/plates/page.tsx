import Epigraph from "@/components/chrome/Epigraph";
import Plates from "@/components/sections/Plates";

// Isolated preview of one section (development only; removed before shipping).
export default function Preview() {
  return (
    <main>
      <Epigraph slot="cipher" />
      <Plates />
      <Epigraph slot="musicBox" />
      <Epigraph slot="plates" />
    </main>
  );
}
