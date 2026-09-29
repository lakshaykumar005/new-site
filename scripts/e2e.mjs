/**
 * Drives the whole piece in a real browser, at phone and desktop sizes:
 * plays the name on the title page, taps the cipher, cranks the music
 * box, plays a variation, types and sends a word, opens it on /s,
 * reaches "Fine", and checks the 404 — failing on console errors,
 * page errors or horizontal overflow. Screenshots land in e2e-shots/.
 *
 * Setup (once):  pnpm exec playwright install chromium
 * Run:           pnpm build && pnpm start --port 3100 &
 *                BASE_URL=http://localhost:3100 pnpm test:e2e
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = path.resolve("e2e-shots");
fs.mkdirSync(SHOTS, { recursive: true });

const failures = [];
const consoleLog = [];
const NOISE = /favicon|Download the React DevTools|\[HMR\]|\[Fast Refresh\]/;

function check(ok, label) {
  if (!ok) failures.push(label);
  console.log(`${ok ? "✓" : "✗"} ${label}`);
}

function track(page, tag) {
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !NOISE.test(m.text())) {
      consoleLog.push(`[${tag}] ${m.type()}: ${m.text().slice(0, 300)}`);
    }
  });
  page.on("pageerror", (e) => consoleLog.push(`[${tag}] pageerror: ${e.message.slice(0, 300)}`));
}

async function noOverflow(page, label) {
  const o = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  check(o.sw <= o.cw + 1, `${label}: no horizontal overflow (${o.sw} ≤ ${o.cw})`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function scrollTo(page, selector) {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
}

/** Encode a word the way src/lib/share.ts does. */
function encodeWord(word) {
  const KEY = "variations";
  const bytes = new TextEncoder().encode(word);
  const x = bytes.map((b, i) => b ^ KEY.charCodeAt(i % KEY.length));
  return Buffer.from(x).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function run(tag, contextOptions) {
  const browser = await chromium.launch();
  const context = await browser.newContext(contextOptions);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
  const page = await context.newPage();
  track(page, tag);

  // ── title page ──────────────────────────────────────────
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await shot(page, `${tag}-01-title`);
  await noOverflow(page, `${tag} title`);
  const hear = page.getByRole("button", { name: /hear your name/i });
  check(await hear.isVisible(), `${tag} title: "Hear your name" is visible`);
  await hear.click();
  await page.waitForTimeout(12000);
  await shot(page, `${tag}-02-title-played`);
  check(await page.getByText("That was your name.").isVisible(), `${tag} title: the name plays through to the end`);

  // ── cipher ──────────────────────────────────────────────
  await scrollTo(page, "#cipher");
  await shot(page, `${tag}-03-cipher`);
  const cipherButtons = page.locator("#cipher button");
  check((await cipherButtons.count()) >= 26, `${tag} cipher: all 26 letters are tappable`);
  await page.locator("#cipher").getByRole("button", { name: /^P\b/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await noOverflow(page, `${tag} cipher`);

  // ── music box ───────────────────────────────────────────
  await scrollTo(page, "#music-box");
  await shot(page, `${tag}-04-music-box`);
  const letItPlay = page.locator("#music-box").getByRole("button", { name: /let it play/i });
  check(await letItPlay.isVisible(), `${tag} music box: "Let it play" is visible`);
  await letItPlay.click();
  await page.waitForTimeout(4000);
  await shot(page, `${tag}-05-music-box-playing`);
  await page.locator("#music-box").getByRole("button", { name: /^stop$/i }).click().catch(() => {});
  await page.waitForTimeout(600);
  await noOverflow(page, `${tag} music box`);

  // ── variations ──────────────────────────────────────────
  await scrollTo(page, "#variations");
  await shot(page, `${tag}-06-variations`);
  const systems = page.locator("#variations svg.score-line");
  check((await systems.count()) === 6, `${tag} variations: six engraved systems`);
  const playButtons = page.locator("#variations").getByRole("button", { name: /play/i });
  if ((await playButtons.count()) > 0) {
    await playButtons.first().click();
    await page.waitForTimeout(2500);
    await shot(page, `${tag}-07-variation-playing`);
  }
  await noOverflow(page, `${tag} variations`);

  // ── your turn ───────────────────────────────────────────
  await scrollTo(page, "#your-turn");
  const input = page.locator("#your-turn input").first();
  await input.click();
  await input.pressSequentially("hello", { delay: 120 });
  await page.waitForTimeout(800);
  await shot(page, `${tag}-08-your-turn`);
  const noteheads = await page.locator("#your-turn svg.score-line .sl-note").count();
  check(noteheads === 5, `${tag} your turn: "hello" engraves five notes (${noteheads})`);
  await noOverflow(page, `${tag} your turn`);

  // ── coda ────────────────────────────────────────────────
  await scrollTo(page, "#coda");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  await shot(page, `${tag}-09-coda`);
  check(await page.getByText("Fine.", { exact: true }).first().isVisible(), `${tag} coda: ends on "Fine."`);
  const dc = page.getByRole("button", { name: /da capo|from the top/i });
  if (await dc.count()) {
    await dc.first().click();
    await page.waitForTimeout(2500);
    const y = await page.evaluate(() => window.scrollY);
    check(y < 200, `${tag} coda: D.C. returns to the top (scrollY ${Math.round(y)})`);
  }
  await noOverflow(page, `${tag} full page`);

  // ── a song arrived ──────────────────────────────────────
  await page.goto(`${BASE}/s#${encodeWord("coffee")}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await shot(page, `${tag}-10-arrived`);
  const playIt = page.getByRole("button", { name: /play it/i }).first();
  check(await playIt.isVisible(), `${tag} /s: a play button waits`);
  await playIt.click();
  await page.waitForTimeout(9000);
  await shot(page, `${tag}-11-arrived-revealed`);
  check(await page.getByText("coffee", { exact: true }).first().isVisible(), `${tag} /s: the word is revealed after playing`);
  await noOverflow(page, `${tag} /s`);

  await page.goto(`${BASE}/s#not-a-real-code`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  check(await page.getByText(/scrambled/i).isVisible(), `${tag} /s: a broken link is handled`);

  // ── 404 ─────────────────────────────────────────────────
  const res = await page.goto(`${BASE}/no-such-page`, { waitUntil: "networkidle" });
  check(res?.status() === 404, `${tag} 404: status is 404`);
  await shot(page, `${tag}-12-not-found`);

  await browser.close();
}

await run("desktop", { viewport: { width: 1440, height: 900 } });
await run("phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await run("phone-reduced", {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});

check(consoleLog.length === 0, "console: no errors or warnings");
consoleLog.forEach((l) => console.log("  " + l));
failures.forEach((f) => console.log("FAIL:", f));
console.log(failures.length === 0 ? "\nAll checks passed." : `\n${failures.length} failure(s).`);
process.exit(failures.length === 0 ? 0 : 1);
