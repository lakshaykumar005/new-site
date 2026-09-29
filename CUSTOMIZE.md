# Make it yours — the checklist

Five minutes, three files, zero component edits.

- [ ] **1. The names** — [src/content/site.ts](src/content/site.ts)
  - `HER_NAME` — the whole piece is composed from it: the melody, the music box
    strip, all six variations, and every count in the copy ("nine letters, nine
    notes"). Change it and the music rewrites itself.
  - `FROM_NAME` — your name, in the credits, the sign-off and the "Send it to …" button.
  - `REPLY_WHATSAPP` *(optional)* — your number, digits only with country code
    (e.g. `919876543210`). When set, "Send it back" opens a WhatsApp chat with you.
    Empty = the phone's own share sheet.

- [ ] **2. The coda** — [src/content/copy.ts](src/content/copy.ts) → `coda.letter`
  - The third paragraph is the one to rewrite in your own words. It reads fine as it
    is, but it lands harder if it's yours.

- [ ] **3. Anything else you'd say differently** — also in `copy.ts`
  - Section titles, the variation descriptions, the music-box counter lines
    ("Four times. I'm choosing to read into that."), the suggestion words in
    "Your turn". Keep the shapes, change the sentences.

Then: push to GitHub → import on Vercel → send her one link.

When she sends a word back, it arrives as a link to `/s#…` — open it and press play.
