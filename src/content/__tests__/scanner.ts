// The banned-text scanner for every response and the serialized record (the
// owner's one-story PRD, step A4). It reports rule names only, never the text
// a rule matched, so a failure message can't leak a private value. It fails,
// and never skips, when privacy.local.json is missing.
//
// privacy.local.json holds the owner's own terms. It is git-ignored, so the
// terms never reach the public repo: copy it from the main checkout.

import { existsSync, readFileSync } from "node:fs";
import { C9, N2 } from "../canonical";

export interface Rule {
  name: string;
  re: RegExp;
}

export const PRIVACY_FILE = new URL("./privacy.local.json", import.meta.url);
export const MISSING_PRIVACY_FILE = "privacy.local.json missing: copy it from the main checkout";

/** Claims and links the PRD bans outright, wherever they appear. */
export const FIXED_RULES: readonly Rule[] = [
  { name: '"Yes."', re: /\bYes\./ },
  { name: '"full-time on Karts"', re: /\bfull[- ]time on Karts\b/i },
  { name: '"worked at NASA"', re: /\bworked at NASA\b/i },
  { name: '"1st place"', re: /\b1st place\b/i },
  { name: '"12x"', re: /\b12x\b/i },
  { name: '"US patent"', re: /\bU\.?S\.? patent\b/i },
  { name: '"patent holder"', re: /\bpatent holder\b/i },
  { name: "quickcompany", re: /quickcompany/i },
  { name: "iprsearch", re: /iprsearch/i },
  { name: "ipindia", re: /ipindia/i },
  { name: "patents.google", re: /patents\.google/i },
];

/** Personal data in general. The owner's own terms come from privacy.local.json. */
export const GENERIC_PRIVACY_RULES: readonly Rule[] = [
  { name: "phone number", re: /\d{3}[- ]\d{3}[- ]\d{4}/ },
  { name: "phone number (parenthesised)", re: /\(\d{3}\)\s?\d{3}[- ]\d{4}/ },
  { name: "international phone", re: /\+\d{1,3}[- ]?\d{5,}/ },
  { name: "date of birth", re: /date of birth/i },
  { name: "born", re: /\bborn\b/i },
  { name: "birthday", re: /\bbirthday\b/i },
  { name: "visa", re: /\bvisa\b/i },
  { name: "immigration", re: /\bimmigration\b/i },
  { name: "GPA", re: /\bGPA\b/ },
  { name: "years old", re: /years old/i },
  { name: "age", re: /\bage(?:d)? \d{1,2}\b/i },
];

/**
 * Text the owner approved for publication that trips one of his own terms.
 * Each span is a canonical string from the PRD, waived for the named terms
 * only, and only where it appears whole. Any other occurrence still fails.
 */
export const APPROVED_SPANS: readonly { text: string; waives: readonly string[]; why: string }[] = [
  {
    text: C9[1],
    waives: ["age at filing"],
    why: "C9, his own About (PRD decision of 6 Oct 2026), gives his age when he built NoteX.",
  },
  {
    text: N2,
    waives: ["age at filing"],
    why: "N2, the canonical patent line the PRD requires on the patent card.",
  },
];

/** The owner's own terms. Throws, so the calling test fails, when the file is missing or empty. */
export function loadPrivacyRules(file: URL = PRIVACY_FILE): Rule[] {
  if (!existsSync(file)) throw new Error(MISSING_PRIVACY_FILE);
  const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error(`${MISSING_PRIVACY_FILE} (it is empty)`);
  return raw.map((entry: { name: string; source: string; flags?: string }) => ({
    name: entry.name,
    re: new RegExp(entry.source, entry.flags),
  }));
}

function hits(re: RegExp, text: string): boolean {
  re.lastIndex = 0;
  const found = re.test(text);
  re.lastIndex = 0;
  return found;
}

export interface ScanOptions {
  /** The owner's terms; read from privacy.local.json when omitted. */
  ownerRules?: readonly Rule[];
  /** Apply APPROVED_SPANS. Off only to prove what a span would trip. */
  waivers?: boolean;
}

/** The names of every rule `text` breaks. Never the matched text. */
export function bannedIn(text: string, options: ScanOptions = {}): string[] {
  const ownerRules = options.ownerRules ?? loadPrivacyRules();
  const waivers = options.waivers ?? true;
  const found: string[] = [];
  for (const rule of [...FIXED_RULES, ...GENERIC_PRIVACY_RULES]) {
    if (hits(rule.re, text)) found.push(rule.name);
  }
  for (const rule of ownerRules) {
    let scanned = text;
    if (waivers) {
      for (const span of APPROVED_SPANS) {
        if (span.waives.includes(rule.name)) scanned = scanned.split(span.text).join(" ");
      }
    }
    if (hits(rule.re, scanned)) found.push(rule.name);
  }
  return found;
}
