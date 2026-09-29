import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GLYPHS } from "@/components/notation/glyphs";
import { clefTransform, flagTransform, glyphAtCentre, layoutScore, type ScoreLayout } from "@/components/notation/layout";
import { titlePage } from "@/content/copy";
import { HER_NAME, SITE_TITLE } from "@/content/site";
import { compose } from "@/lib/music/compose";
import { COVER_SIZE } from "./coverMeta";

/**
 * The link preview (WhatsApp, iMessage, X): the cover of a first-edition
 * score. A ruled frame, the title in Bodoni italic, a dedication to her,
 * and the theme engraved beneath it with her letters under the notes.
 * Rendered once at build time; fonts are static TTFs in assets/og.
 */

/** The dedication line under the title. */
const FOR = "for";

const PAPER = "#f4eee3";
const INK = "#1c1b2b";
const INK_SOFT = "#4a4757";
const GRAPHITE = "#8c8577";
const STAFF = "#48475a"; // ink at 78% on paper, as the site draws staff lines
const VERMILLION = "#d9432a";

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 800; style: "normal" | "italic" };

let fonts: Promise<Font[]> | null = null;

function loadFonts(): Promise<Font[]> {
  const dir = join(process.cwd(), "assets", "og");
  const load = async (file: string) => {
    const buf = await readFile(join(dir, file));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  };
  fonts ??= Promise.all([
    load("BodoniModa-Italic-48-500.ttf"),
    load("BodoniModa-Italic-28-500.ttf"),
    load("BodoniModa-Roman-14-800.ttf"),
    load("DMMono-Regular.ttf"),
    load("Newsreader-Italic-24-400.ttf"),
  ]).then(([name, text, figures, mono, serif]): Font[] => [
    { name: "Bodoni Name", data: name, weight: 500, style: "italic" },
    { name: "Bodoni Text", data: text, weight: 500, style: "italic" },
    { name: "Bodoni Figures", data: figures, weight: 800, style: "normal" },
    { name: "DM Mono", data: mono, weight: 400, style: "normal" },
    { name: "Newsreader", data: serif, weight: 400, style: "italic" },
  ]);
  return fonts;
}

/** Where the staff ends: the right edge of its final barline (whose thick stroke reaches 0.1 space past its x). */
function staffEnd(l: ScoreLayout): number {
  return (l.bars.find((b) => b.kind === "final")?.x ?? l.right - 0.1 * l.s) + 0.1 * l.s;
}

/** The engraved line as a standalone SVG, cropped to where the staff ends (text is laid over it by the renderer). */
function staffSvg(l: ScoreLayout, sounding: string | null, width: number): string {
  const { s, top, bottom, left } = l;
  const out: string[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, w: number, c = INK) =>
    out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`);
  const rect = (x: number, y: number, w: number, h: number) =>
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${INK}"/>`);

  // a staff ends at its final barline
  const end = staffEnd(l);
  for (let i = 0; i < 5; i++) line(left, top + i * s, end, top + i * s, 0.1 * s, STAFF);
  if (l.clef) out.push(`<path d="${GLYPHS.gClef.d}" transform="${clefTransform(l.clef.x, bottom, s)}" fill="${INK}"/>`);
  for (const b of l.bars) {
    if (b.kind === "final") {
      rect(b.x - 0.72 * s, top, 0.12 * s, 4 * s);
      rect(b.x - 0.4 * s, top, 0.5 * s, 4 * s);
    } else rect(b.x, top, 0.12 * s, 4 * s);
  }
  for (const n of l.notes) {
    const c = n.ev.id === sounding ? VERMILLION : INK;
    const glyph = n.head === "whole" ? "wholeNote" : n.head === "half" ? "noteheadHalf" : "noteheadBlack";
    const half = n.headW / 2 + 0.42 * s;
    for (const y of n.ledgers) line(n.x - half, y, n.x + half, y, 0.16 * s, c);
    out.push(`<path d="${GLYPHS[glyph].d}" transform="${glyphAtCentre(glyph, n.x, n.y, s)}" fill="${c}"/>`);
    if (n.stem) {
      const y1 = n.stem === "up" ? n.y - 0.15 * s : n.y + 0.15 * s;
      line(n.stemX, y1, n.stemX, n.stemEnd, 0.12 * s, c);
    }
    for (let f = 0; f < n.flags; f++) {
      const t = flagTransform(n.stemX - 0.06 * s, n.stemEnd, s, n.stem === "down", f * 0.8 * s);
      out.push(`<path d="${GLYPHS.eighthFlagUp.d}" transform="${t}" fill="${c}"/>`);
    }
    if (n.dot) out.push(`<circle cx="${n.dotX}" cy="${n.dotY}" r="${0.19 * s}" fill="${c}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.ceil(l.height)}" viewBox="0 0 ${width} ${Math.ceil(l.height)}">${out.join("")}</svg>`;
}

export async function renderCover(): Promise<ImageResponse> {
  const score = compose(HER_NAME, "theme");
  const STAFF_W = 720;
  const layout = layoutScore(score, { width: STAFF_W, space: 10, letters: true });
  const { s } = layout;
  // the staff is as wide as it is drawn (it ends at its final barline), so it centres under her name
  const drawnW = Math.ceil(staffEnd(layout));
  // the first note, caught in the act of sounding
  const svg = staffSvg(layout, score.melody[0]?.id ?? null, drawnW);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const staffH = Math.ceil(layout.height);
  const figSize = 2.8 * s;
  const letterSize = 1.35 * s;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          background: PAPER,
          color: INK,
          fontFamily: "Bodoni Text",
        }}
      >
        {/* a thick-and-thin frame, as engraved title pages have */}
        <div style={{ position: "absolute", left: 30, top: 30, right: 30, bottom: 30, border: `3px solid ${INK}` }} />
        <div style={{ position: "absolute", left: 39, top: 39, right: 39, bottom: 39, border: `1px solid ${INK}` }} />

        {/* scoring and opus, the way the title page prints them */}
        <div
          style={{
            position: "absolute",
            left: 74,
            right: 74,
            top: 64,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: INK_SOFT,
          }}
        >
          <div style={{ display: "flex", fontFamily: "DM Mono", fontSize: 14, letterSpacing: "0.22em" }}>
            {titlePage.scoring.toUpperCase()}
          </div>
          <div style={{ display: "flex", fontFamily: "Bodoni Text", fontStyle: "italic", fontSize: 25, color: INK }}>
            {titlePage.opus}
          </div>
        </div>

        <div
          style={{
            marginTop: 122,
            display: "flex",
            fontFamily: "Bodoni Text",
            fontStyle: "italic",
            fontSize: 64,
            lineHeight: 1,
            letterSpacing: "-0.004em",
          }}
        >
          {SITE_TITLE}
        </div>

        <div style={{ marginTop: 22, display: "flex", alignItems: "center", color: INK_SOFT }}>
          <div style={{ width: 64, height: 1, background: INK_SOFT }} />
          <div
            style={{
              display: "flex",
              margin: "0 20px",
              fontFamily: "Bodoni Text",
              fontStyle: "italic",
              fontSize: 30,
              lineHeight: 1,
            }}
          >
            {FOR}
          </div>
          <div style={{ width: 64, height: 1, background: INK_SOFT }} />
        </div>

        <div
          style={{
            marginTop: 4,
            display: "flex",
            fontFamily: "Bodoni Name",
            fontStyle: "italic",
            fontSize: 140,
            lineHeight: 1.06,
            letterSpacing: "-0.012em",
          }}
        >
          {HER_NAME}
        </div>

        <div style={{ marginTop: 2, display: "flex", position: "relative", width: drawnW, height: staffH }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- rendered to a PNG, never to a page */}
          <img src={src} width={drawnW} height={staffH} style={{ position: "absolute", left: 0, top: 0 }} />
          {layout.time &&
            [layout.time.top, layout.time.bottom].map((d, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: layout.time!.x - figSize,
                  top: layout.top + (i === 0 ? 1 : 3) * s - figSize / 2,
                  width: figSize * 2,
                  height: figSize,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Bodoni Figures",
                  fontWeight: 800,
                  fontSize: figSize,
                  lineHeight: 1,
                  color: INK,
                }}
              >
                {d}
              </div>
            ))}
          {layout.notes.map((n) => (
            <div
              key={n.ev.id}
              style={{
                position: "absolute",
                left: n.x - 20,
                top: layout.labelY - 0.841 * letterSize,
                width: 40,
                height: letterSize,
                display: "flex",
                justifyContent: "center",
                fontFamily: "DM Mono",
                fontSize: letterSize,
                lineHeight: 1,
                color: GRAPHITE,
              }}
            >
              {n.ev.char}
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            left: 74,
            right: 74,
            bottom: 60,
            display: "flex",
            justifyContent: "center",
            fontFamily: "Newsreader",
            fontStyle: "italic",
            fontSize: 22,
            color: INK_SOFT,
          }}
        >
          {titlePage.credits.join("  ·  ")}
        </div>
      </div>
    ),
    { ...COVER_SIZE, fonts: await loadFonts() }
  );
}
