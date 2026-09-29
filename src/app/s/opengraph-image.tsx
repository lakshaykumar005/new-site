import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GLYPHS } from "@/components/notation/glyphs";
import { clefTransform, glyphAtCentre } from "@/components/notation/layout";
import { arrived } from "@/content/copy";
import { SITE_TITLE } from "@/content/site";

// The preview for a song someone sent: the word stays a secret, so the
// card shows a staff of notes with nothing written under them.
export const alt = `${arrived.kicker}: ${arrived.title}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f4eee3";
const INK = "#1c1b2b";
const INK_SOFT = "#4a4757";
const STAFF = "#48475a";
const VERMILLION = "#d9432a";

async function font(file: string) {
  const buf = await readFile(join(process.cwd(), "assets", "og", file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** A staff with a clef, five notes and no words, closing on a fermata. */
function staffSvg(): string {
  const s = 16;
  const w = 640;
  const top = 3 * s;
  const bottom = top + 4 * s;
  const lines = [0, 1, 2, 3, 4]
    .map((i) => `<line x1="0" x2="${w - 4}" y1="${top + i * s}" y2="${top + i * s}" stroke="${STAFF}" stroke-width="${0.1 * s}"/>`)
    .join("");
  const steps = [4, 3, 6, 5, 3];
  const notes = steps
    .map((step, i) => {
      const x = 150 + i * 92;
      const y = bottom - (step * s) / 2;
      const up = step < 4;
      const stemX = up ? x + 0.55 * s : x - 0.55 * s;
      const fill = i === 0 ? VERMILLION : INK;
      return (
        `<path d="${GLYPHS.noteheadBlack.d}" transform="${glyphAtCentre("noteheadBlack", x, y, s)}" fill="${fill}"/>` +
        `<line x1="${stemX}" x2="${stemX}" y1="${up ? y - 0.15 * s : y + 0.15 * s}" y2="${up ? y - 3.5 * s : y + 3.5 * s}" stroke="${fill}" stroke-width="${0.12 * s}"/>`
      );
    })
    .join("");
  const bar = `<rect x="${w - 16}" y="${top}" width="${0.12 * s}" height="${4 * s}" fill="${INK}"/><rect x="${w - 10}" y="${top}" width="${0.5 * s}" height="${4 * s}" fill="${INK}"/>`;
  const fermata = `<path d="${GLYPHS.fermata.d}" transform="${glyphAtCentre("fermata", w - 8, top - 1.4 * s, s)}" fill="${INK}"/>`;
  const clef = `<path d="${GLYPHS.gClef.d}" transform="${clefTransform(6, bottom, s)}" fill="${INK}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${bottom + 3 * s}" viewBox="0 0 ${w} ${bottom + 3 * s}">${lines}${clef}${notes}${bar}${fermata}</svg>`;
}

export default async function Image() {
  const [title, mono, serif] = await Promise.all([
    font("BodoniModa-Italic-48-500.ttf"),
    font("DMMono-Regular.ttf"),
    font("Newsreader-Italic-24-400.ttf"),
  ]);
  const svg = `data:image/svg+xml;base64,${Buffer.from(staffSvg()).toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, padding: 30 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `3px solid ${INK}`,
            outline: `1px solid ${INK}`,
            outlineOffset: -10,
            padding: "40px 60px",
          }}
        >
          <div style={{ fontFamily: "DM Mono", fontSize: 18, letterSpacing: 5, color: INK_SOFT, textTransform: "uppercase" }}>
            {arrived.kicker}
          </div>
          <div
            style={{
              fontFamily: "Bodoni",
              fontStyle: "italic",
              fontSize: 60,
              lineHeight: 1.1,
              color: INK,
              textAlign: "center",
              marginTop: 26,
              maxWidth: 900,
            }}
          >
            {arrived.title}
          </div>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={svg} width={640} height={160} style={{ marginTop: 36 }} />
          <div style={{ fontFamily: "Newsreader", fontStyle: "italic", fontSize: 26, color: INK_SOFT, marginTop: 20 }}>
            {arrived.lede}
          </div>
          <div style={{ fontFamily: "DM Mono", fontSize: 14, letterSpacing: 4, color: INK_SOFT, marginTop: 30, textTransform: "uppercase" }}>
            {SITE_TITLE}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bodoni", data: title, weight: 500, style: "italic" },
        { name: "DM Mono", data: mono, weight: 400, style: "normal" },
        { name: "Newsreader", data: serif, weight: 400, style: "italic" },
      ],
    }
  );
}
