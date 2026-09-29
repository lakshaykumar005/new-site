"use client";

/** A tiny tap of vibration where the platform allows it (Android). */
export function haptic(ms = 8) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* unsupported */
  }
}

const VISITS_KEY = "von:visits";

/** Counts this visit once per page load and returns the running total. */
let counted: number | null = null;
export function countVisit(): number {
  if (counted !== null) return counted;
  let n = 1;
  try {
    n = (parseInt(window.localStorage.getItem(VISITS_KEY) ?? "0", 10) || 0) + 1;
    window.localStorage.setItem(VISITS_KEY, String(n));
  } catch {
    /* storage unavailable: treat as a first visit */
  }
  counted = n;
  return n;
}

/** Day of the year in the visitor's own time zone (1–366). */
export function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}
