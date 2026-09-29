"use client";

import { chrome } from "@/content/copy";
import { useSound } from "@/lib/music/hooks";

/**
 * The only fixed element on the page: a small printed speaker, top
 * right. Muting persists between visits.
 */
export default function SoundToggle() {
  const { muted, toggleMuted, unlock } = useSound();

  return (
    <button
      type="button"
      onClick={() => {
        void unlock();
        toggleMuted();
      }}
      aria-pressed={!muted}
      aria-label="Sound"
      title={muted ? chrome.soundOff : chrome.soundOn}
      className="fixed right-[max(12px,env(safe-area-inset-right))] top-[max(12px,env(safe-area-inset-top))] z-50 grid h-11 w-11 place-items-center rounded-full border border-rule bg-paper-raised/80 text-ink backdrop-blur-[2px] transition-colors duration-300 hover:border-ink-soft"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        {muted ? (
          <path d="M13.5 8l4 4m0-4l-4 4" stroke="var(--color-vermillion)" strokeWidth="1.3" strokeLinecap="round" />
        ) : (
          <>
            <path d="M13.2 7.4a3.6 3.6 0 010 5.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M15.4 5.3a6.6 6.6 0 010 9.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}
