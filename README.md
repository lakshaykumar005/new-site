# Variations on a Name

A small piece of music, transcribed from a name.

Her name, run through the old composers' cipher — the first seven letters of the
alphabet are already notes, and after G you start again at A — turns out to be a
melody. This site plays it, shows the trick, lets her turn it on a paper music box,
plays it six different ways, lets her turn any word into a song and send it back,
and ends, as scores do, on *Fine*.

No samples and no video: the music box is synthesized in the browser, the
notation is engraved in code, her portrait is engraved from a photograph on a
canvas, and the music is computed from one line in `src/content/site.ts`.

## The pages

A score is a book, so the site is one too: eight pages, turned with the page
turner at the foot of each, a sideways swipe on a phone, or ← / → on a keyboard.
The running head at the top left opens the contents.

| p. | Page | Route | What happens |
| --- | --- | --- | --- |
| 1 | **Title page** | `/` | Her name set like a published score. One tap: each letter drops a note onto the staff and plays it, then the whole theme plays with its harmony. |
| 2 | **Frontispiece** | `/frontispiece` | Her portrait, engraved in the browser in ~170 lines of ink from a photograph; it prints itself top to bottom. Touch it for the photograph. |
| 3 | **The cipher** *(Fig. 1)* | `/cipher` | The composers' trick (Schumann's Op. 1 was variations on a name). A tappable cipher table that can spell her name out loud. |
| 4 | **The music box** *(Fig. 2)* | `/music-box` | A patent-drawing music box. Turn the handle or pull the paper — it plays at the speed of her hand, backwards too. Beside it an engraver's plate: every note cuts the next lines of her portrait into it (the strip's rows are the portrait's bands), until, after two passes of the song, she's there. |
| 5 | **Variations** *(Fig. 3)* | `/variations` | A page of printed music: the theme, crab-wise, upside down, as a waltz, as a 2 a.m. lullaby, and allegro. Each one plays. |
| 6 | **Plates** | `/plates` | Three of her photographs as plates in a fine edition, printed in ink; touch one and the colour comes back. Captioned in musical markings: *Scherzando*, *Dolce*, *Notturno*. |
| 7 | **Your turn** *(Fig. 4)* | `/your-turn` | Any word becomes a song as she types it. "Send it back" shares a link that hides the word until it's played. |
| 8 | **Coda** | `/coda` | A short note from you, and the last bar: *Fine.* |
| | **A song arrived** | `/s` | Where a sent word lands: press play, and the letters appear under the notes as they sound. |

Quotations of your own go at the head of pages 3–8 — see `epigraphs` in
`src/content/copy.ts`.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000 (add --port 3100 if 3000 is busy)
pnpm build        # production build — every route prerenders static
```

On a phone on the same Wi-Fi, open the "Network" address `next dev` prints
(add your LAN IP to `allowedDevOrigins` in `next.config.ts` if it differs).

## Make it yours

See [CUSTOMIZE.md](CUSTOMIZE.md) — a five-minute checklist. Everything personal is in
`src/content/`; no component edits needed.

## Test it

```bash
pnpm exec playwright install chromium     # once
pnpm build && pnpm start --port 3100 &
BASE_URL=http://localhost:3100 pnpm test:e2e
```

Reads the whole score in a real browser at phone and desktop sizes — plays the name,
turns every page, opens the contents, taps the cipher, cranks the music box, plays a
variation, tints a plate, types a word, opens it on `/s`, reaches *Fine* — and fails on
console errors or horizontal overflow. Screenshots land in `e2e-shots/`.

## Deploy

Push to GitHub and import the repo on [Vercel](https://vercel.com) — no settings, no
environment variables, no database. The site is static and tagged `noindex`.

## How it's made

- **Next.js 16** (App Router, Turbopack), **React 19**, **Tailwind CSS 4**, TypeScript.
- **Sound**: a WebAudio music box — each note is a struck steel tine (a sine fundamental,
  a slightly sharp octave, and the tine's inharmonic overtone at ~6.27×), the click of the
  pin, a warm lowpass and a generated room. iOS audio session set to `playback`, so the
  ringer switch doesn't silence it. Nothing plays until she touches something.
- **Music**: `src/lib/music/` — the cipher, white-key pitch arithmetic, and a little
  composer that gives any word a lilting 3/4 rhythm, harmonises every bar with the chord
  that fits it best and cadences home; plus retrograde, inversion, waltz, lullaby and
  allegro variations.
- **Notation**: `src/components/notation/` — a real engraving layout (duration-weighted
  spacing, stem direction, flags, dots, ledger lines, barlines) using glyph outlines baked
  from Noto Music (SIL OFL).
- **Type**: Bodoni Moda, Newsreader, DM Mono.
