# Make it yours — the checklist

Ten minutes, four files, zero component edits.

- [ ] **1. The names** — [src/content/site.ts](src/content/site.ts)
  - `HER_NAME` — the whole piece is composed from it: the melody, the music box
    strip, all six variations, and every count in the copy ("nine letters, nine
    notes"). Change it and the music rewrites itself.
  - `FROM_NAME` — your name, in the credits, the sign-off and the "Send it to …" button.
  - `REPLY_WHATSAPP` *(optional)* — your number, digits only with country code
    (e.g. `919876543210`). When set, "Send it back" opens a WhatsApp chat with you.
    Empty = the phone's own share sheet.

- [ ] **2. Your quotes** — [src/content/copy.ts](src/content/copy.ts) → `epigraphs`
  - Six slots, one at the head of each page from the cipher to the coda
    (`cipher`, `musicBox`, `variations`, `plates`, `yourTurn`, `coda`).
    Each is `{ text, by?, reply? }` — `by` is printed small after an em dash,
    `reply` is an answer beneath it. `null` leaves the page without one.
  - Two are filled in to start (Shakespeare); replace them freely.

- [ ] **3. The words her portrait is written in** — `copy.ts` → `frontispiece`
  - `microText` — the sentences the engraved portrait is made of, in reading
    order; they repeat until every line is full. Add your own lines anywhere.
  - `hidden` — sentences set at a particular spot in her face (`u` across,
    `v` down, 0–1). The glass starts over the first one. Keep them short.

- [ ] **4. The coda** — `copy.ts` → `coda.letter`
  - The third paragraph is the one to rewrite in your own words.

- [ ] **5. Photographs** — [src/content/photos.ts](src/content/photos.ts)
  - Captions (`mark`, `gloss`, `line`) and alt text for each plate live here.
  - To change a photo, put the originals in a folder and run
    `python3 scripts/photos.py <that folder>` (needs `pip3 install pillow numpy`).
    It writes the colour and ink versions of every plate and the tone map the
    frontispiece is engraved from. The file names it expects are listed at the
    bottom of `scripts/photos.py`.

Anything else — section titles, the variation descriptions, the music-box counter
lines ("Four times. I'm choosing to read into that.") — is also in `copy.ts`.
Keep the shapes, change the sentences.

Then: push to GitHub → import on Vercel → send her one link.

When she sends a word back, it arrives as a link to `/s#…` — open it and press play.
