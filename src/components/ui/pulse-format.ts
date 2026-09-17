import { useSyncExternalStore } from "react";

// A shared clock for relative times. It ticks once a minute while anything is
// subscribed, reads 0 on the server, and is read from render only through
// useSyncExternalStore so renders stay pure.

let now = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    timer = window.setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  if (now === 0) now = Date.now();
  return now;
}

function getServerSnapshot(): number {
  return 0;
}

/** Milliseconds since the epoch, refreshed once a minute. 0 before hydration. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

let formatter: Intl.RelativeTimeFormat | null = null;

/** "3 days ago", "yesterday", "just now". Null when either side is unknown. */
export function relativeTime(iso: string | null, now: number): string | null {
  if (!iso || !now) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const seconds = Math.round((then - now) / 1000);
  const magnitude = Math.abs(seconds);
  if (magnitude < 60) return "just now";
  formatter ??= new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (magnitude >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** "1.2k" for 1,234; "342" below a thousand. */
export function compactCount(value: number): string {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}
