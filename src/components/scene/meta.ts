// Star metadata for the scene: when work started, what it was built with and
// which repo backs it. The record's own fields win; a start date falls back
// to the first year named in the human-readable period, which is also record
// text. A dev-only override fills any remaining gaps.

import { TIMELINE_START_YEAR, type Facet, type Star, type StarMeta } from "@/lib/contract";

export interface StartDate {
  year: number;
  /** 1..12 */
  month: number;
  /** Months since January of TIMELINE_START_YEAR. Drives timeline positions. */
  index: number;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function makeDate(year: number, month: number): StartDate {
  const m = Math.min(12, Math.max(1, month));
  return { year, month: m, index: (year - TIMELINE_START_YEAR) * 12 + (m - 1) };
}

/** "YYYY-MM" (or "YYYY") as the contract defines `start`. */
export function parseStart(start: string | undefined): StartDate | null {
  if (!start) return null;
  const match = /^(\d{4})(?:-(\d{1,2}))?/.exec(start.trim());
  if (!match) return null;
  return makeDate(Number(match[1]), match[2] ? Number(match[2]) : 1);
}

/**
 * First date named in a period such as "Aug 2024 – Dec 2025", "Jul 24, 2026",
 * "Filed Oct 2020 · granted Jan 2025" or "2022 – 2026".
 */
export function parsePeriod(period: string | undefined): StartDate | null {
  if (!period) return null;
  const match = /(?:([A-Za-z]{3})[a-z]*\.?\s+(?:\d{1,2},?\s+)?)?(\d{4})/.exec(period);
  if (!match) return null;
  const month = match[1] ? (MONTHS[match[1].toLowerCase()] ?? 1) : 1;
  return makeDate(Number(match[2]), month);
}

export interface ResolvedMeta {
  start: StartDate | null;
  stack: string[];
  repo?: string;
}

export function resolveMeta(star: Star, override?: StarMeta): ResolvedMeta {
  const start = parseStart(star.start) ?? parsePeriod(star.period) ?? parseStart(override?.start);
  const stack = star.stack && star.stack.length > 0 ? star.stack : (override?.stack ?? []);
  const repo = star.repo ?? override?.repo;
  return { start, stack: stack.slice(0, 8), repo };
}

/** The first facet of a star, which the record lists as its lead fact. */
export function firstFacet(facets: Facet[], starId: string): Facet | undefined {
  return facets.find((facet) => facet.starId === starId);
}

/** Canonical key for a technology name, so "TypeScript" and "typescript" merge. */
export function techKey(name: string): string {
  return name.trim().toLowerCase().replace(/[\s._-]+/g, "");
}
