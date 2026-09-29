/**
 * Reads the whole score in a real browser, page by page, at phone and
 * desktop sizes: plays the name on the title page, turns every page,
 * opens the contents, taps the cipher, cranks the music box, plays a
 * variation, tints a plate, types a word, opens it on /s, reaches
 * "Fine", and checks the 404 — failing on console errors, page errors
 * or horizontal overflow. Screenshots land in e2e-shots/.
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

const PAGES = ["/", "/frontispiece", "/cipher", "/music-box", "/variations", "/plates", "/your-turn", "/coda"];

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

/** Scroll the whole page so every reveal has fired. */
async function readThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

async function open(page, route) {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
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

  // ── every page loads cleanly ────────────────────────────
  for (const route of PAGES) {
    const res = await page.goto(BASE + route, { waitUntil: "networkidle" });
    check(res?.status() === 200, `${tag} ${route}: 200`);
    await readThrough(page);
    await noOverflow(page, `${tag} ${route}`);
  }

  // ── 1. title page: the name plays ───────────────────────
  await open(page, "/");
  await shot(page, `${tag}-01-title`);
  const hear = page.getByRole("button", { name: /hear your name/i });
  check(await hear.isVisible(), `${tag} title: "Hear your name" is visible`);
  await hear.click();
  await page.waitForTimeout(12000);
  await shot(page, `${tag}-02-title-played`);
  check(await page.getByText("That was your name.").isVisible(), `${tag} title: the name plays through to the end`);

  // ── turning a page ──────────────────────────────────────
  await page.getByRole("link", { name: /turn the page/i }).first().click();
  await page.waitForURL("**/frontispiece");
  await page.waitForTimeout(3000);
  check(page.url().endsWith("/frontispiece"), `${tag} page turn: title → frontispiece`);
  await shot(page, `${tag}-03-frontispiece`);
  const plate = page.locator("#frontispiece button").first();
  await plate.click();
  await page.waitForTimeout(900);
  check((await plate.getAttribute("aria-pressed")) === "true", `${tag} frontispiece: touch shows the photograph`);

  // ── the contents ────────────────────────────────────────
  await page.getByRole("button", { name: /open the contents/i }).click();
  await page.waitForTimeout(600);
  check(await page.locator("dialog[open]").isVisible(), `${tag} contents: opens`);
  await shot(page, `${tag}-04-contents`);
  await page.locator("dialog[open]").getByRole("link", { name: /the cipher/i }).click();
  await page.waitForURL("**/cipher");
  await page.waitForTimeout(900);
  check(!(await page.locator("dialog[open]").count()), `${tag} contents: closes on the way to a page`);

  // ── 3. cipher ───────────────────────────────────────────
  await shot(page, `${tag}-05-cipher`);
  check((await page.locator("#cipher button").count()) >= 26, `${tag} cipher: all 26 letters are tappable`);

  // ── 4. music box ────────────────────────────────────────
  await open(page, "/music-box");
  await page.locator("#music-box").scrollIntoViewIfNeeded();
  const letItPlay = page.locator("#music-box").getByRole("button", { name: /let it play/i });
  check(await letItPlay.isVisible(), `${tag} music box: "Let it play" is visible`);
  await letItPlay.scrollIntoViewIfNeeded();
  await letItPlay.click();
  await page.waitForTimeout(4000);
  await shot(page, `${tag}-06-music-box-playing`);
  await page.locator("#music-box").getByRole("button", { name: /^stop$/i }).click().catch(() => {});

  // ── 5. variations ───────────────────────────────────────
  await open(page, "/variations");
  check((await page.locator("#variations svg.score-line").count()) === 6, `${tag} variations: six engraved systems`);
  const playButtons = page.locator("#variations").getByRole("button", { name: /play/i });
  if ((await playButtons.count()) > 0) {
    await playButtons.first().scrollIntoViewIfNeeded();
    await playButtons.first().click();
    await page.waitForTimeout(2500);
    await shot(page, `${tag}-07-variation-playing`);
  }

  // ── 6. plates ───────────────────────────────────────────
  await open(page, "/plates");
  const firstPlate = page.locator("#plates figure button").first();
  await firstPlate.scrollIntoViewIfNeeded();
  await firstPlate.click();
  await page.waitForTimeout(1000);
  check((await firstPlate.getAttribute("aria-pressed")) === "true", `${tag} plates: touch brings the colour back`);
  await shot(page, `${tag}-08-plate-tinted`);

  // ── 7. your turn ────────────────────────────────────────
  await open(page, "/your-turn");
  const input = page.locator("#your-turn input").first();
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await input.pressSequentially("hello", { delay: 120 });
  await page.waitForTimeout(800);
  await shot(page, `${tag}-09-your-turn`);
  const noteheads = await page.locator("#your-turn svg.score-line .sl-note").count();
  check(noteheads === 5, `${tag} your turn: "hello" engraves five notes (${noteheads})`);

  // ── 8. coda ─────────────────────────────────────────────
  await open(page, "/coda");
  await readThrough(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  await shot(page, `${tag}-10-coda`);
  check(await page.getByText("Fine.", { exact: true }).first().isVisible(), `${tag} coda: ends on "Fine."`);
  const dc = page.getByRole("button", { name: /da capo|from the top/i });
  if (await dc.count()) {
    await dc.first().click();
    await page.waitForURL(BASE + "/", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
    check(new URL(page.url()).pathname === "/", `${tag} coda: D.C. returns to the title page`);
  }

  // ── arrow keys (desktop only) ───────────────────────────
  if (!contextOptions.hasTouch) {
    await open(page, "/cipher");
    await page.keyboard.press("ArrowRight");
    await page.waitForURL("**/music-box", { timeout: 5000 }).catch(() => {});
    check(page.url().endsWith("/music-box"), `${tag} keys: → turns the page`);
    await page.waitForTimeout(800);
    await page.keyboard.press("ArrowLeft");
    await page.waitForURL("**/cipher", { timeout: 5000 }).catch(() => {});
    check(page.url().endsWith("/cipher"), `${tag} keys: ← turns it back`);
  }

  // ── a song arrived ──────────────────────────────────────
  await open(page, `/s#${encodeWord("coffee")}`);
  await shot(page, `${tag}-11-arrived`);
  const playIt = page.getByRole("button", { name: /play it/i }).first();
  check(await playIt.isVisible(), `${tag} /s: a play button waits`);
  await playIt.click();
  await page.waitForTimeout(9000);
  await shot(page, `${tag}-12-arrived-revealed`);
  check(await page.getByText("coffee", { exact: true }).first().isVisible(), `${tag} /s: the word is revealed after playing`);
  await noOverflow(page, `${tag} /s`);

  await open(page, "/s#not-a-real-code");
  check(await page.getByText(/scrambled/i).isVisible(), `${tag} /s: a broken link is handled`);

  // ── 404 ─────────────────────────────────────────────────
  const res = await page.goto(`${BASE}/no-such-page`, { waitUntil: "networkidle" });
  check(res?.status() === 404, `${tag} 404: status is 404`);
  await shot(page, `${tag}-13-not-found`);

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
