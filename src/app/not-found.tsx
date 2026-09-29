import Link from "next/link";
import RestBar from "@/components/sections/coda/RestBar";
import { chrome } from "@/content/copy";

/** A missing page, printed like the rest of the score: one bar of silence. */
export default function NotFound() {
  // each sentence on its own line
  const sentences = chrome.notFoundLede.split(/(?<=[.!?])\s+/);
  return (
    <main className="grid min-h-[100svh] place-items-center py-24">
      <div className="wrap flex flex-col items-center text-center">
        <RestBar className="block h-auto w-[15.5rem] max-w-full text-ink" />
        <h1 className="t-display mt-10 max-w-[17ch]">{chrome.notFoundTitle}</h1>
        <p className="t-lede mt-5 max-w-[26rem]">
          {sentences.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </p>
        <Link href="/" className="btn-quiet mt-10">
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden>
            <path
              d="M6 13V1.6M1.8 5.6 6 1.4l4.2 4.2"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {chrome.notFoundHome}
        </Link>
      </div>
    </main>
  );
}
