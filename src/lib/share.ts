/**
 * A word travels inside the link's #hash — never sent to any server —
 * lightly scrambled so the chat preview doesn't give it away before
 * it's played.
 */

const KEY = "variations";
export const MAX_WORD = 24;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function xor(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ KEY.charCodeAt(i % KEY.length);
  return out;
}

export function encodeWord(word: string): string {
  return toBase64Url(xor(new TextEncoder().encode(word.trim().slice(0, MAX_WORD))));
}

export function decodeWord(code: string): string | null {
  const raw = fromBase64Url(code.replace(/^#/, "").trim());
  if (!raw || raw.length === 0 || raw.length > MAX_WORD * 4) return null;
  try {
    const word = new TextDecoder("utf-8", { fatal: true }).decode(xor(raw)).trim();
    if (!word || word.length > MAX_WORD || !/\p{L}/u.test(word)) return null;
    return word;
  } catch {
    return null;
  }
}

/** The link that plays `word` on the other end. */
export function songLink(word: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/s#${encodeWord(word)}`;
}
