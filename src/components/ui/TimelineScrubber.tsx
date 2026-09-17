"use client";

// A slim dual-thumb range over the years of the record, with a Play button
// that sweeps the upper bound from the first year to the last over about six
// seconds. Two native range inputs sit on one rail, so arrow keys and
// aria-valuetext come for free.

import { useEffect, useId, useState, type ChangeEvent } from "react";
import { TIMELINE_END_YEAR, TIMELINE_START_YEAR } from "@/lib/contract";
import { useFlight } from "@/lib/flight-state";

const YEARS: number[] = [];
for (let year = TIMELINE_START_YEAR; year <= TIMELINE_END_YEAR; year += 1) YEARS.push(year);
const SPAN = TIMELINE_END_YEAR - TIMELINE_START_YEAR;
const THUMB = 14;
const STEP_MS = 1000;

/** Position of a year along the rail, matching where the native thumb sits. */
function at(year: number): string {
  const fraction = (year - TIMELINE_START_YEAR) / SPAN;
  return `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${fraction.toFixed(4)})`;
}

export function TimelineScrubber({ className }: { className?: string }) {
  const { yearRange, setYearRange } = useFlight();
  const [lo, hi] = yearRange;
  const [playing, setPlaying] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!playing) return;
    let year = TIMELINE_START_YEAR;
    const timer = window.setInterval(() => {
      year += 1;
      setYearRange([TIMELINE_START_YEAR, year]);
      if (year >= TIMELINE_END_YEAR) setPlaying(false);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing, setYearRange]);

  const onPlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setYearRange([TIMELINE_START_YEAR, TIMELINE_START_YEAR]);
    setPlaying(true);
  };

  const onLow = (event: ChangeEvent<HTMLInputElement>) => {
    setPlaying(false);
    const value = Number(event.target.value);
    setYearRange([Math.min(value, hi), hi]);
  };
  const onHigh = (event: ChangeEvent<HTMLInputElement>) => {
    setPlaying(false);
    const value = Number(event.target.value);
    setYearRange([lo, Math.max(value, lo)]);
  };

  const all = lo === TIMELINE_START_YEAR && hi === TIMELINE_END_YEAR;
  // When both thumbs meet, the one that can still move must be on top.
  const lowOnTop = lo === hi && lo === TIMELINE_END_YEAR;

  return (
    <div className={className ? `scrubber ${className}` : "scrubber"} role="group" aria-labelledby={`${id}-label`}>
      <button
        type="button"
        className="scrub-play"
        onClick={onPlay}
        aria-pressed={playing}
        aria-label={playing ? "Stop playing the years" : "Play the years from 2020 to 2026"}
      >
        {playing ? (
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2" y="2" width="3" height="8" rx="0.5" fill="currentColor" />
            <rect x="7" y="2" width="3" height="8" rx="0.5" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 1.8v8.4L10 6z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="scrub-track">
        <div className="scrub-rail" aria-hidden="true" />
        <div className="scrub-fill" aria-hidden="true" style={{ left: at(lo), right: `calc(100% - ${at(hi)})` }} />
        <div className="scrub-ticks" aria-hidden="true">
          {YEARS.map((year) => (
            <span key={year} className={year >= lo && year <= hi ? "tick is-in" : "tick"} style={{ left: at(year) }}>
              {year}
            </span>
          ))}
        </div>
        <input
          type="range"
          className={lowOnTop ? "scrub-thumb is-top" : "scrub-thumb"}
          min={TIMELINE_START_YEAR}
          max={TIMELINE_END_YEAR}
          step={1}
          value={lo}
          onChange={onLow}
          aria-label="From year"
          aria-valuetext={`From ${lo}`}
        />
        <input
          type="range"
          className={lowOnTop ? "scrub-thumb" : "scrub-thumb is-top"}
          min={TIMELINE_START_YEAR}
          max={TIMELINE_END_YEAR}
          step={1}
          value={hi}
          onChange={onHigh}
          aria-label="To year"
          aria-valuetext={`To ${hi}`}
        />
      </div>
      <span id={`${id}-label`} className="scrub-label mono" aria-live="polite">
        {all ? "All years" : lo === hi ? String(lo) : `${lo}–${hi}`}
      </span>
    </div>
  );
}
