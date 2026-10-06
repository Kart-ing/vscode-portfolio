import type { AnswerSentence, FlightStop, ScriptedAnswer, TourStep } from "@/lib/contract";
import { C11, C2 } from "./canonical";

// Curated, model-free answers: "What has Kartikey built?" (the first chip,
// which hire, back and invest questions also get), the highlights for
// greetings and vague questions, and the guided tour.
//
// Rules. Every sentence cites at least one facet from record.ts, and every
// fact and every number in a sentence appears in the text of a facet it cites.
// No sentence is uncited, and none opens with "Yes" or "No". Role facts appear
// only as the C11 sentences, verbatim. Sentences name Kartikey and, apart from
// those frozen C11 sentences, never use pronouns for Kartikey. The content
// tests enforce all of this.

/** Star ids never contain a dot, so a facet id parses into its stop. */
function cite(facetId: string): FlightStop {
  return { starId: facetId.slice(0, facetId.indexOf(".")), facetId };
}

export function say(text: string, ...facetIds: string[]): AnswerSentence {
  return { text, citations: facetIds.map(cite) };
}

/**
 * "What has Kartikey built?": the first chip. Hire, back and invest
 * questions get the same cited lines, never a scripted verdict.
 */
export const advocate: ScriptedAnswer = {
  question: "What has Kartikey built?",
  view: {
    kind: "timeline",
    starIds: [
      "intel",
      "patent",
      "hackpsu-spring-2023",
      "psu-hackathon-team",
      "recompress",
      "compiled-11",
      "compiled-13",
      "zero-human-company-hackathon",
      "karts",
    ],
  },
  sentences: [
    say(C11.karts, "karts.founder"),
    say(C2, "karts.what"),
    say(
      "Kartikey has won 13 prizes at 12 hackathons, including The Token Company's Best Compression Model prize, UC Berkeley AI Hackathon 2026, with Parth Kshirsagar.",
      "zero-human-company-hackathon.count",
      "berkeley-ai-hackathon-2026.prize",
    ),
    say(
      "Kartikey co-authored the ReCompress preprint with Parth Kshirsagar and is the sole inventor and applicant on Indian Patent No. 558662, since lapsed.",
      "recompress.preprint",
      "patent.inventor",
      "patent.what",
    ),
  ],
};

/** The answer for vague questions such as "hi" or "tell me something impressive". */
export const highlights: ScriptedAnswer = {
  question: "What should I know about Kartikey?",
  sentences: [
    say(C11.karts, "karts.founder"),
    say(
      "Kartikey has won 13 prizes at 12 hackathons, including two $1,000 Hexclave awards, at c0mpiled-11 with Cited and at c0mpiled-13 with Swiper No Swiping.",
      "zero-human-company-hackathon.count",
      "compiled-11.prize",
      "compiled-13.prize",
    ),
    say(
      "Re:Compress, built with Parth Kshirsagar, won The Token Company's Best Compression Model prize at the UC Berkeley AI Hackathon 2026, and the same work became the ReCompress preprint on Zenodo.",
      "berkeley-ai-hackathon-2026.prize",
      "berkeley-ai-hackathon-2026.paper",
    ),
    say(
      "Kartikey is the sole inventor and applicant on Indian Patent No. 558662, filed in October 2020 during high school, granted in January 2025 and since lapsed.",
      "patent.what",
      "patent.inventor",
      "patent.timeline",
    ),
  ],
};

function step(holdMs: number, text: string, ...facetIds: string[]): TourStep {
  return { sentence: say(text, ...facetIds), holdMs };
}

/**
 * The guided tour: about a minute of autoplay. Each step's first citation is
 * the star the camera visits. The story runs Karts, agent tools, research and
 * the patent, the hackathon run, leadership, work, and back to Karts.
 */
export const tour: TourStep[] = [
  step(6000, C11.karts, "karts.founder"),
  step(
    5500,
    "Multiverse is the branch predictor, but for tool calls: it forks into parallel sandboxed futures, commits one winner atomically and replays deterministically.",
    "multiverse.what",
  ),
  step(
    5000,
    "PingPal, published on npm, is ambient messaging for CLI coders: see teammates' ASCII faces and send 90-char pings inside Claude Code.",
    "pingpal.what",
    "pingpal.npm",
  ),
  step(
    4500,
    "Hermes Offloader offloads work from your laptop to a cheap always-on server via /offload in Claude Code.",
    "hermes-offloader.what",
  ),
  step(
    6000,
    "ReCompress, a Zenodo preprint of June 21, 2026, by Parth Sanjay Kshirsagar and Kartikey Pandey: the 1.5B student compresses HotpotQA context to about 3.5% of its tokens and still answers correctly.",
    "recompress.preprint",
    "recompress.result",
  ),
  step(
    5500,
    "Kartikey is the sole inventor and applicant on Indian Patent No. 558662, filed in October 2020 during high school, granted in January 2025 and since lapsed.",
    "patent.what",
    "patent.inventor",
    "patent.timeline",
  ),
  step(
    4500,
    "In April 2023, SignEase won 3rd Place at HackPSU Spring 2023.",
    "hackpsu-spring-2023.prize",
  ),
  step(
    5500,
    "Two $1,000 Hexclave awards: at c0mpiled-11, a hackathon hosted by Transpose during YC Startup School weekend, with Cited, and at c0mpiled-13, Startup School Hackathon II, with Swiper No Swiping.",
    "compiled-11.prize",
    "compiled-13.prize",
  ),
  step(
    5500,
    "Kartikey has won 13 prizes at 12 hackathons; the latest was 3rd place in Best use of Render at the Zero Human Company Hackathon by Terac, in August 2026, with AdLayer.",
    "zero-human-company-hackathon.count",
    "zero-human-company-hackathon.prize",
  ),
  step(
    5500,
    "As Founder & President of the Penn State Collegiate Hackathon Team, Kartikey lifted Penn State from #185 to #74 (merit rank) in one year.",
    "psu-hackathon-team.rank",
    "psu-hackathon-team.role",
  ),
  step(5000, C11.cara, "cara.role"),
  step(5500, C2, "karts.what"),
];
