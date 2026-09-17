"use client";

import { useSyncExternalStore } from "react";
import { sound } from "./sound";

// The footer's speaker. Off by default; the click is the user gesture that
// creates the AudioContext.
export function SoundToggle() {
  const on = useSyncExternalStore(sound.subscribe, sound.get, sound.getServer);
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={on}
      title={on ? "Turn ambient sound off" : "Turn ambient sound on"}
      onClick={() => sound.toggle()}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M2 6h2.6L8 3.2v9.6L4.6 10H2z" fill="currentColor" />
        {on ? (
          <>
            <path d="M10.2 5.6a3.2 3.2 0 0 1 0 4.8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <path d="M12 3.6a6 6 0 0 1 0 8.8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <path d="M10.3 6.3l3.4 3.4M13.7 6.3l-3.4 3.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        )}
      </svg>
      <span>{on ? "Sound on" : "Sound off"}</span>
    </button>
  );
}
