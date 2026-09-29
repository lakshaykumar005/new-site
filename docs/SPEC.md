# Variations on a Name — build spec

## The idea

A gift website for Pavithraa (`HER_NAME`), from Lakshay (`FROM_NAME`), who are getting to
know each other. Her name, run through the old composers' cipher (A–G are notes; after G the
alphabet wraps back to A), becomes a real melody. The site plays it, explains the trick,
lets her crank it on a paper music box, shows six variations of it, lets her turn any word
into a song and send it back, and closes with a short note that ends on the word **Fine**.

Emotional arc: curiosity (her name, typeset like the title of a published score) → wonder
(the letters become notes and it plays) → charm (the trick is real and old — Schumann's
Op. 1 was variations on a name) → play (the crank) → delight (six moods) → reciprocity
(her turn; send one back) → warmth (the coda) → a smile (*Fine.*).

Tone: warm, witty, flirty-but-classy, unhurried; second person to her, first person from him.
**Never invent facts about her.** All copy lives in `src/content/copy.ts` and is final.

## Art direction — "a printed score and a patent drawing"

Daylight. Warm paper, blue-black ink, and exactly one accent — vermillion — reserved for
things that *sound* (a note being played, a punched hole passing the comb, the play disc).
Everything is printed: hairlines, engraving, reference numerals. **Nothing glows. Nothing
drifts. The page is completely still until she touches it** — motion and sound are always a
response to her hand (the one exception: gentle reveal-on-scroll of text blocks, and the
staff lines drawing in once on the title page).

Tokens (Tailwind 4 theme, see `src/app/globals.css`):

| token | hex | role |
| --- | --- | --- |
| `paper` | `#f4eee3` | page |
| `paper-deep` | `#ebe3d4` | recessed panels, shadows under objects |
| `paper-raised` | `#fbf8f2` | the paper strip, cards, inputs |
| `ink` | `#1c1b2b` | text, staff lines, linework |
| `ink-soft` | `#4a4757` | secondary text (AA on paper) |
| `graphite` | `#8c8577` | annotations, captions (large/decorative only) |
| `rule` | `#d6ccba` | hairlines on paper |
| `vermillion` | `#d9432a` | sounding things, play disc, focus ring |
| `vermillion-deep` | `#b8341f` | vermillion used as small text |
| `blush` | `#f2d5c9` | selection, faint highlight wash |

Type (loaded in `layout.tsx` as CSS variables; use the role classes in `globals.css`):

- **Bodoni Moda** (variable, opsz + wght, italic) — `.t-title` (the name), `.t-display`
  (section titles), `.t-heading`, `.t-mark` (Italian tempo markings). Display is italic.
- **Newsreader** (variable, opsz) — `.t-body`, `.t-lede`. All reading text.
- **DM Mono** — `.t-kicker` ("Fig. 2 — The mechanism"), `.t-caption`, `.t-mono`, note
  names, button labels.

Buttons: `.btn-play` (ink pill with a vermillion disc — the one "primary" style) and
`.btn-quiet` (hairline pill). Layout helpers: `.wrap` (max 72rem + gutters), `.measure`
(34rem), `.section` (generous vertical padding). Min touch target 44px.

Motion: `--ease-out` for entrances, `--ease-spring` for playful settles, durations 180 /
320 / 640 / 960ms. Honour `prefers-reduced-motion` (`useReducedMotion()` in `src/lib/hooks.ts`):
no drops/bounces/vibration; fades only; user-driven motion (the music box strip) still works.
Add `className="reveal"` to any block that should fade up on first scroll into view (the
`RevealObserver` handles it). No GSAP, no Lenis, no particles, no WebGL, no background
music, no dark mode, no script fonts, no emoji.

## Foundation you build on (do not modify — report needed changes instead)

- `src/lib/music/cipher.ts` — `spell(word)` → `{char, index, note, dn}[]`; `CIPHER_ROWS`,
  `NOTE_COLUMNS`, `noteOfLetter`, `themeDnOf`, `cipherCell`.
- `src/lib/music/theory.ts` — `midiOfDn`, `letterOfDn`, `nameOfDn`, `trebleStep`, …
  A pitch is a diatonic number `dn` (white keys above C0; A4 = 33). Treble step 0 = E4.
- `src/lib/music/compose.ts` — `compose(word, id)` → `Score` with `melody`, `events`
  (melody + accompaniment, sorted), `bars` (with chords), `length` (beats), `bpm`, `time`.
  `VARIATION_ORDER`: theme, retrograde, inversion, waltz, lullaby, allegro.
- `src/lib/music/audio.ts` — `musicBox.unlock()` (call inside the gesture handler, before
  anything async), `musicBox.pluck(midi, {when?, velocity?, voice?})`, `musicBox.tick()`,
  `musicBox.now()`, `.muted`, `.audible`.
- `src/lib/music/player.ts` — `play(score, {onNote, onFrame, onDone, rate, voices})`,
  `stopAll()`. Exclusive: starting one playback stops any other.
- `src/lib/music/hooks.ts` — `useSound()` → `{muted, unlocked, toggleMuted, unlock}`;
  `useScorePlayer()` → `{playing, activeId, playedIds, start(score, opts), stop(), beat}`
  (`beat` is a ref updated per frame — drive playheads by DOM writes, not state).
- `src/components/notation/ScoreLine.tsx` — `<ScoreLine score width? space? clef? time?
  letters?="char"|"note"|"both" activeId playedIds beatRef playing />` — a fully engraved
  line (clef, time signature, noteheads, stems, flags, dots, ledgers, barlines, playhead).
  Active notes turn vermillion with a ring. See it at `/lab`.
- `src/components/notation/layout.ts` — `layoutScore(score, opts)` pure geometry, plus
  `glyphAtCentre`, `clefTransform`, `flagTransform` for bespoke animation.
- `src/components/notation/glyphs.ts` — `GLYPHS` (gClef, fClef, noteheadBlack,
  noteheadHalf, wholeNote, finalBarline, fermata, quarterRest, eighthFlagUp, segno,
  daCapo) as SVG paths in font units (250 units = one staff space; y up — flip it).
- `src/lib/device.ts` — `haptic(ms)`, `countVisit()`, `dayOfYear()`.
- `src/lib/share.ts` — `encodeWord`, `decodeWord`, `songLink(word, origin)`, `MAX_WORD`.
- `src/content/site.ts` (`HER_NAME`, `FROM_NAME`, `REPLY_WHATSAPP`, `SITE_TITLE`) and
  `src/content/copy.ts` (all copy + `NAME_FACTS`, `numberWord`). Don't edit these; if you
  genuinely need an extra string (an aria-label, a button label), declare it as a const at
  the top of your own component and list it in your report.
- `SoundToggle` is fixed at the top-right and the Contents running head at the top-left
  (both 44px, safe-area aware) on every page — keep a 64×64px clear zone in both top corners.
- The site is a book of eight pages (`src/content/pages.ts`); each page ends with the page
  turner, and ← / → or a sideways swipe turns pages. Anything that takes horizontal gestures
  itself uses `touch-action: none` (or `data-noswipe`).

## Sections (page order) and their owners

Each section is one component in `src/components/sections/`, previewed in isolation at
`http://localhost:3100/lab/<route>` (the dev server is already running on port 3100 —
never start or stop it). The full page is `http://localhost:3100/`.

### 1. TitlePage — `#top` — `/lab/title`

A score's title page, one screen tall (`min-h-[100svh]`), centred column:
`titlePage.eyebrow` (kicker) · a 48px hairline · `titlePage.on` (Bodoni italic, ink-soft) ·
**HER_NAME** in `.t-title`, as large as fits (fit it to the column width by measuring;
must work for names of 3–12 letters; each letter its own span) · a treble staff under the
name, the width of the name, with a clef at its left · a row with `titlePage.scoring` left and
`titlePage.opus` right (t-caption / t-mark) · `titlePage.credits` (two lines, Newsreader
italic, small) · the CTA `.btn-play` with ▶ disc + `titlePage.play`, and `titlePage.soundHint`
under it. If `countVisit() > 1`, show `titlePage.welcomeBack` above the eyebrow (caption,
vermillion-deep).

First paint: the five staff lines draw in left-to-right once (960ms, `--ease-out`).

On CTA (call `musicBox.unlock()` synchronously in the handler): for each letter in turn
(~280ms apart) the letter lifts 4px and turns vermillion, a notehead drops from under the
letter onto its staff position (spring settle), a stem draws, `musicBox.pluck` the note on
landing (`haptic(6)`), and its note name appears beneath in DM Mono; the letter settles back to
ink. Notes sit under the centre of their letter (not engraved spacing). Then ~500ms pause and
the full theme (`compose(HER_NAME,'theme')`) plays with accompaniment via `useScorePlayer`,
each note flashing vermillion as it sounds. Then fade in `titlePage.after` (two lines) and a
page-turn cue (the next page's title, "Frontispiece", with a hairline arrow — a link with
`transitionTypes={["nav-forward"]}`), and the CTA becomes `titlePage.again` (replays
the full theme only). If sound is muted, the visuals run the same and `titlePage.mutedNote`
appears. Listen for `window` event `"von:replay"` (dispatched by the Coda's D.C. button) and
replay the full theme. Reduced motion: notes fade in place, letters tint without lifting.

### 2. Cipher — `#cipher` — `/lab/cipher`

`cipher.kicker` · `cipher.title` (t-display) · `cipher.paragraphs` (t-body, measure).
**The cipher table**: 4 rows × 7 columns (`CIPHER_ROWS`) under a header row of the notes
A–G (`NOTE_COLUMNS`, Bodoni italic, vermillion-deep) labelled `cipher.columnsLabel`. Every
letter is a 44px button in DM Mono; the letters of HER_NAME carry a hairline ink ring. Tap a
letter → `unlock` + pluck its note (`themeDnOf`), the cell and its column header flash
vermillion, and a readout shows e.g. "P → B". `cipher.tableCaption` under the table.
A quiet "Spell it out" button (`.btn-quiet`) walks through HER_NAME: each letter's cell
lights, its column header lights, the note plays (~340ms apart).
**The derivation**: `cipher.derivationLabel`, then HER_NAME as pairs — the letter (Bodoni
italic, large) over a hairline arrow over its note (DM Mono) — revealing in sequence when
scrolled into view (visual only); tapping a pair plays its note. Then `cipher.result`
(t-lede), then `cipher.kicker2` as a pull line (t-heading) and `cipher.closing` (t-body).

### 3. MusicBox — `#music-box` — `/lab/music-box` — the signature

`musicBoxCopy.kicker` · `.title` · `.lede`. Then **the mechanism**, drawn as a patent
illustration in SVG (ink hairlines on paper, fine hatching for shade, reference numerals in
circles with leader lines): a horizontal **paper strip** (a loop) running through a **comb**
of steel teeth, driven by a **handle** (crank). Under the figure, a key:
"1 — handle", "2 — comb", "3 — paper strip" using `musicBoxCopy.callouts` (comb takes the
tooth count = number of distinct pitches on the strip).

The strip is punched with `compose(HER_NAME,'theme').events` (melody and accompaniment): one
row per distinct pitch (high at top), x = beat. Printed grid: hairline pitch rows, faint beat
lines, stronger bar lines, tiny note names at the left edge. Holes are ink circles; a hole
flashes vermillion as it passes the comb. The strip moves right-to-left when playing forward;
it loops seamlessly (render enough copies to cover the viewport).

Input & physics (rAF loop only while moving; idle = no frames):
- **Crank**: drag around its centre; clockwise = forward; one revolution = 3 beats. Angular
  delta from `atan2`, unwrapped.
- **Pull the paper**: horizontal drag on the strip moves it directly (drag left = forward).
- **Inertia**: on release keep velocity (EMA of recent motion), friction `v *= exp(-2.2·dt)`,
  stop under 0.05 beats/s; clamp ±12 beats/s. Backwards is allowed and plays backwards.
- **Let it play** (`musicBoxCopy.letItPlay` / `.stop`): eases velocity toward the theme's
  tempo (bpm/60 beats/s); any drag cancels it.
- **Sound**: whenever a hole's beat is crossed (either direction, handle the loop wrap),
  `musicBox.pluck(ev.midi, {velocity: ev.velocity, voice: ev.voice})`; its comb tooth quivers
  (skip under reduced motion). Every 1/8 turn of the crank → `musicBox.tick()` + `haptic(4)`.
- Above the strip, HER_NAME in Bodoni italic (small): the letter whose melody note is sounding
  lights vermillion.
- Count complete forward passes; at 2, 4, 8, 16 show `musicBoxCopy.playCounts[n]` under the
  figure (fade, `aria-live="polite"`).
- Touch: `touch-action: none` on the crank and strip only (the page must still scroll when
  swiping elsewhere, including vertically over the figure's non-interactive parts). Pointer
  events with pointer capture. Show `hintTouch` / `hintPointer` (by `(pointer: coarse)`).
- Keyboard: the figure is focusable; ←/→ nudge the velocity, Space toggles Let it play.
- Phone: the strip is full-bleed; the crank sits below the strip at the right, big enough to
  grab (≥ 96px diameter). Desktop: a wider, taller figure; the crank to the right of the strip.

### 4. Variations — `#variations` — `/lab/variations`

`variationsCopy.kicker` · `.title` · `.lede`. Then a page of printed music: six systems
stacked (VARIATION_ORDER). Each: header row with `mark` (t-mark, italic) and `title`
(t-heading, smaller) on the left and a round 44px play/stop button (vermillion disc ▶ / ■)
on the right; the engraved `<ScoreLine>` of `compose(HER_NAME, id)` with `letters="char"`;
then `line` (t-body, ink-soft). One plays at a time (`useScorePlayer`); the playing system
shows its playhead and lights notes as they sound. `dayOfYear() % 6` picks "today's"
variation: a small `variationsCopy.todaysPick` badge (kicker, vermillion-deep) and a
vermillion hairline at its left. Systems separated generously; on desktop keep systems full
width inside a ~56rem column.

### 5. YourTurn — `#your-turn` — `/lab/your-turn` (+ the `/s` page)

`yourTurn.kicker` · `.title` · `.lede`. A large underlined input (Bodoni italic ~2rem,
`maxLength = MAX_WORD`, `aria-label = yourTurn.inputLabel`, placeholder). As she types, each
new letter plucks its note (call `unlock` in the input handler) and the engraved ScoreLine of
`compose(word,'theme')` below updates live with `letters="char"`; empty → an empty staff and
`yourTurn.empty`. Suggestion chips (`yourTurn.tryLabel`, `.suggestions`) set the word and
play it. Buttons: `.btn-play` Play/Stop, `.btn-quiet` `yourTurn.send` (disabled when empty).
Send: `songLink(word, location.origin)`; if `REPLY_WHATSAPP` → open
`https://wa.me/<n>?text=` (shareText + link); else `navigator.share({title, text, url})`;
else clipboard + `yourTurn.copied` toast (aria-live). `yourTurn.sendNote` beneath. Show
`yourTurn.tooLong` when the limit is hit.

**`/s` — a song arrived** (`src/app/s/page.tsx` + `src/components/sections/Arrived.tsx`):
reads `location.hash` on mount → `decodeWord`. Valid: `arrived.kicker`, `arrived.title`
(t-display), `arrived.lede`, the engraved notes of the word with letters hidden, and Play.
As each note sounds its letter appears beneath it; at the end `arrived.reveal` and the word
itself, large, in `.t-title`; then links `arrived.answer` → `/your-turn` and `arrived.home`
→ `/`. Invalid/missing hash: `arrived.invalidTitle` + `.invalidLede` + home link.

### 6. Coda — `#coda` — `/lab/coda` (+ site meta)

`coda.kicker` · `coda.title` (t-display) · `coda.letter` paragraphs (t-body, measure; a
Bodoni italic drop cap on the first) · `coda.signoff` (Bodoni italic, right). Then the ending:
a short full-width staff that ends in a final double barline with a fermata above it and
**`coda.fine`** in large Bodoni italic beneath the barline, like the end of a score. When it
first scrolls into view: the staff draws in; if `musicBox.audible`, play the theme's final
chord softly once. `coda.fineNote` beneath (small italic). Then `.btn-quiet` `coda.daCapo`
(aria-label `coda.daCapoLabel`): smooth-scroll to `#top`, then
`window.dispatchEvent(new Event("von:replay"))`. A tiny colophon at the very bottom: "Set in
Bodoni Moda, Newsreader and DM Mono. Engraved in code." (t-caption, centred).

Site meta (same owner): `src/app/icon.svg` (a vermillion notehead on paper), `src/app/
not-found.tsx` (`chrome.notFound*`, same art direction), `src/app/robots.ts` (disallow all),
`src/app/opengraph-image.tsx` (1200×630: paper, "Variations on a Name" in Bodoni italic, "for
HER_NAME", an engraved staff with her notes — load TTFs for ImageResponse from Google Fonts
at build time or commit them under `assets/`).

## Quality bar (every section)

- Looks designed at **390×844 (touch, DPR 2)** and **1440×900**: typographic rhythm, no
  widows in headings (`text-wrap: balance`), nothing touching screen edges, nothing under the
  sound toggle, no horizontal overflow, no layout shift.
- Zero console errors or React warnings; `pnpm exec tsc --noEmit --incremental false` and
  `pnpm exec eslint <your files>` clean for your files.
- Works with sound muted and before audio is unlocked (visuals still perform).
- Reduced motion honoured. Keyboard reachable with visible focus. Buttons have names.
- Verify by driving the page with Playwright (chromium from `node_modules/playwright`):
  screenshot phone + desktop, click/drag the interactions, look at the screenshots, fix, repeat.

## Added: her photographs and epigraphs

### 7. Frontispiece — `#frontispiece` — `/lab/frontispiece` (after the title page)

Scores open with an engraved portrait facing the title page. Hers is engraved **in the
browser**: `public/photos/frontispiece-tone.png` (R = darkness, G = form) is drawn on a canvas
as ~170 horizontal lines of ink whose width swells with darkness and bends around her
features, plus a light cross-hatch in the deepest shadows, inside an oval vignette. It prints
top-to-bottom once when it scrolls into view. Touch → cross-fade to the colour photograph
(`FRONTISPIECE.photo`, same oval), touch again → back. Caption from `frontispiece` in
copy.ts. (Built by the integrator.)

### 8. Plates — `#plates` — `/lab/plates` (after Variations)

`platesCopy.kicker` · `.title` · `.lede`. Then the plates from `PLATES` in
`src/content/photos.ts`, laid out like tipped-in plates in a fine edition — never a grid or
a wall of photos: one plate per "page" on a phone, generous margins; on desktop an
asymmetric but calm book layout (alternate left/right placement, varying widths, captions
beside or beneath). Each plate: the ink duotone (`duo`) inside a plate mark (the faint
debossed rectangle an intaglio plate presses into paper: a hairline border 10–14px outside
the image with a barely darker paper tone inside it — no drop shadows), a small `Pl. n`
label (DM Mono), and the caption: `mark` (Bodoni italic, large) + `gloss` (DM Mono caps,
small) + `line` (Newsreader italic). **Touch or hover a plate → the colour photograph fades
in over the duotone** (≈700ms, `--ease-out`), like a hand-tinted print; touch again (or
leave) → back to ink. Reduced motion: instant swap. The crescendo plate is a **pair**: two
photos side by side (stacked on a narrow phone if needed) with each `label` beneath, and a
real **crescendo hairpin** (two hairlines opening from a point, "<") drawn in SVG across the
pair with *cresc.* in italic — the pair should read as one plate. Images: plain `<img>` with
`width`/`height`, `loading="lazy"`, `decoding="async"`, `alt` from the data; never
upscaled past their pixel width.

### 9. Epigraphs — `src/components/chrome/Epigraph.tsx`

`<Epigraph slot="cipher" />` renders `epigraphs[slot]` (copy.ts) between sections, or the
plain fermata `Divider` when the slot is `null`. Set like the epigraph at the head of a
movement: centred, `text` in Bodoni italic (~1.5–2rem, balanced), `by` beneath after an em
dash in DM Mono caps (small, ink-soft), and `reply` (if any) beneath that in Newsreader
(ink-soft). Hairline rules above and below, generous vertical space; `.reveal`.

## Revised: pages 5 and 6 (the user rejected the static versions — "revamp with proper animation and transitions effects, with a lot of things which are very different")

### 5. Variations — "The Kaleidoscope" — `/variations`

Replace the six stacked systems with ONE instrument. Keep `variationsCopy` (kicker, title,
lede, the six `items` with mark/title/line, todaysPick, play/stop) — add new keys only.

- **The dial.** Six tempo markings (`items[*].mark`, Bodoni italic) sit around a ring like the
  bezel of a watch or the ring of a music-box cylinder; the current one sits at the top, in
  ink; the others fade to graphite. She turns it by dragging round it (pointer capture,
  `touch-action: none` on the ring only), by a horizontal swipe on the staff, with ← / →, or
  by tapping a marking. It snaps to the nearest position with a spring; every detent gives
  `musicBox.tick()` + `haptic(4)`.
- **The morph.** One engraved staff (`ScoreLine`-quality notation: clef, time signature, note
  heads, stems, flags, dots, barlines — reuse `layoutScore` for the geometry of each variation
  and animate between the two layouts) shows the current variation. Turning the dial
  MORPHS it into the next over ~700ms: each note glides to its new x/y (notes are matched
  by their `letter` index so her letters travel with their notes), stems re-orient, the time
  signature crossfades, barlines slide. Retrograde: the notes run the staff backwards
  (matched letters cross past each other). Inversion: a mirror line appears on the middle
  staff line and the melody flips over it. Waltz: the staff swings gently on the bass (a
  slight 3-beat sway while playing). Lullaby: the whole plate dims to a night print (ink
  paper, pale lines) and the notes slow. Allegro: the notes quicken and the staff brightens.
  Use the Web Animations API / rAF with the `--ease-spring` and `--ease-out` curves.
- **Playing.** One play disc (vermillion) plays the current variation via `useScorePlayer`;
  the playhead runs, notes light vermillion as they sound, and turning the dial mid-play
  hands the playhead to the new variation at the same beat fraction (no stop/restart).
- **Her letters** under the notes travel with their notes during a morph.
- Under the instrument: `title` (t-heading) and `line` (t-body) of the current variation,
  crossfading (old slides out up, new slides in from below, 320ms). "Today's pick" is a small
  vermillion tick on that marking of the dial.
- Phone: the ring is ~280px wide, the staff full-bleed below it, the text below that.
  Desktop: ring left, staff + text right, both vertically centred, one screen tall.
- Reduced motion: no morph (instant swap with a 200ms crossfade), no sway.

### 6. Plates — "The Print Room" — `/plates`

Replace the stacked plates with a printing press. Keep `platesCopy` and `PLATES` — add new
keys only.

- **Each plate is a print run.** A plate mark (the debossed rectangle) sits empty on the page.
  As it scrolls into view (IntersectionObserver, once): an ink roller (an SVG cylinder with a
  handle, drawn as a patent illustration) rolls across the plate left→right (900ms,
  `--ease-in-out`) leaving the plate inked (the duotone fades up behind it); then a sheet of
  paper (a `paper-raised` rectangle with a hairline edge and a soft curl) lies on the plate and
  is PULLED OFF from one corner (a diagonal wipe via `clip-path` polygon, 1100ms) revealing
  the print (the duotone) on the sheet — the sheet is what stays on the page, slightly
  rotated (±1.5°) like a print left to dry, with a small "Pl. n" and the caption beneath.
  Touch / hover the print → colour blooms in from the touch point (a radial `mask-image`
  growing from the pointer position, 700ms) — hand-tinting; touch again → back to ink.
- Three plates only (Scherzando, Dolce, Notturno) — the user removed the Tutti and
  Crescendo plates; there is no pair any more.
- Between print runs, small marginalia: the plate number, the marking (`mark`, Bodoni
  italic, large), the gloss (DM Mono caps) and `line` (Newsreader italic) — laid out as a
  colophon beside the print on desktop, beneath it on phone.
- Ambient: nothing moves until scrolled to; the roller and the pull happen once per plate;
  a "Print again" (small `.btn-quiet`) re-runs a plate's print. Reduced motion: the print
  simply fades in (400ms); tint is an instant swap.
- Images: plain `<img>` with width/height, lazy, async, alt from the data; never upscaled.

Both pages: zero console errors, no horizontal overflow, 60fps (transform/opacity/clip-path
only in animations; no layout thrash), keyboard operable, and every animation honours
`prefers-reduced-motion`.
