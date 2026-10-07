// Canonical strings from the owner's one-story PRD (PRD-ONE-STORY-2026-10-06,
// approved 6 Oct 2026). The other surfaces (LinkedIn, resume, GitHub) use the
// same strings, so every one of them is copied here verbatim and used whole.
// Do not edit a frozen string to fit a sentence; write the sentence around it.

/** R2, the display line. The page title is `${name} · ${ROLE_LINE}`. */
export const ROLE_LINE = "Founder, Karts (part-time)";

/** C1, the one-liner: hero tagline, meta description and OG description. */
export const C1 =
  "I've been building for AI since before ChatGPT was a thing. Now I'm building Karts, so your coding agents get their own copy of the app to break instead of the real one.";

/** C2, the Karts line, on the Karts star. */
export const C2 =
  "Karts gives every coding agent its own running copy of your app and database, so it breaks that instead of the real one. It's early.";

/** C5(a), the only traction line the site may show, on the Karts star. */
export const C5A = "My first version had a funded team using it every day, a week after my first commit.";

/** C9, the long About (his version 2), one string per paragraph. */
export const C9: readonly string[] = [
  "I've been building for AI since before ChatGPT was a thing.",
  "At 16 I built NoteX, an app that turned your lectures into notes right on your device. Its summarizer became my first patent. Six years later my friend Parth and I came back to the same problem for LLMs, built Re:Compress, and won The Token Company's Best Compression Model prize at the UC Berkeley AI Hackathon.",
  "I've picked up 13 hackathon prizes along the way and been a founding engineer at two startups (ColdStart, and Raya Health from HF0 W26).",
  "Now I'm building Karts, so your coding agents get their own copy of the app to break instead of the real one. My first version had a funded team using it every day, a week after my first commit. Still early, still building.",
  "By day I'm at Cara. If you're building with coding agents, I'd love to talk!",
];

/** C11 (R4), the site's role sentences, one per role facet. */
export const C11 = {
  karts: "Kartikey is the founder of Karts, which he builds part-time alongside his job at Cara.",
  cara: "Kartikey has been a Member of Technical Staff at Cara since June 2026.",
  raya: "Kartikey was a Founding Engineer at Raya Health (HF0 W26) from December 2025 to June 2026, where he built patient-facing AI agents for intake, triage and eligibility.",
  coldstart:
    "Kartikey was a Founding Engineer at ColdStart from January to December 2025, building a Reddit social-listening engine.",
  intel:
    "In high school, Kartikey was an Internship Trainee and then an Apprentice at Intel, from August 2020 to July 2021.",
} as const;

/** C3 dates (R1), for the period field of each role star. */
export const C3_DATES = {
  karts: "Aug 2026 – present",
  cara: "Jun 2026 – present",
  raya: "Dec 2025 – Jun 2026",
  coldstart: "Jan 2025 – Dec 2025",
  intel: "Aug 2020 – Jul 2021",
  education: "Aug 2022 – May 2026",
} as const;

/** C4 numbers. Each appears verbatim where the PRD's number mapping requires it. */
export const N1 = "13 prizes at 12 hackathons";
export const N2 = "Indian Patent No. 558662, filed 2020 (at 16), granted 2025, since lapsed";
export const N3 =
  "The Token Company's Best Compression Model prize, UC Berkeley AI Hackathon 2026, with Parth Kshirsagar";
/** N4: the v2 preprint DOI, as a link. */
export const N4_DOI_URL = "https://doi.org/10.5281/zenodo.20787487";
export const N5 = "#185 to #74 (merit rank) in one year";

/** Every frozen sentence the site shows whole, for tests that exempt frozen text. */
export const FROZEN_TEXTS: readonly string[] = [C1, C2, ...C9, ...Object.values(C11)];
