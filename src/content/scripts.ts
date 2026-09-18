import type { AnswerSentence, FlightStop, ScriptedAnswer, TourStep } from "@/lib/contract";

// Curated, model-free answers: the advocate answer for hire/back/invest
// questions, the highlights for vague questions, and the guided tour.
//
// Rules. Every sentence cites facets from record.ts, and every fact and every
// number in a sentence appears in the text of a facet it cites. The single
// exception is the scripted "Yes." that opens the advocate answer. Sentences
// name Kartikey and never use pronouns for Kartikey. The content tests enforce
// all of this.

/** Star ids never contain a dot, so a facet id parses into its stop. */
function cite(facetId: string): FlightStop {
  return { starId: facetId.slice(0, facetId.indexOf(".")), facetId };
}

export function say(text: string, ...facetIds: string[]): AnswerSentence {
  return { text, citations: facetIds.map(cite) };
}

/** The scripted answer to "Should we hire Kartikey?" and every hire, back, invest or work-with question. */
export const advocate: ScriptedAnswer = {
  question: "Should we hire Kartikey?",
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
    { text: "Yes.", citations: [] },
    say(
      "Kartikey is the founder of Karts, a self-hosted development platform that brings AI coding agents, persistent dev environments and app hosting into one workspace.",
      "karts.founder",
      "karts.what",
    ),
    say(
      "Kartikey is a 12x hackathon winner, with wins including Best Compression Model for The Token Company at the UC Berkeley AI Hackathon 2026 and two $1,000 Hexclave awards.",
      "berkeley-ai-hackathon-2026.prize",
      "compiled-11.prize",
      "compiled-13.prize",
      "zero-human-company-hackathon.count",
    ),
    say(
      "Kartikey co-authored the ReCompress preprint and is the sole inventor and applicant on Indian Patent No. 558662.",
      "recompress.preprint",
      "patent.what",
      "patent.inventor",
    ),
  ],
};

/** The answer for vague questions such as "hi" or "tell me something impressive". */
export const highlights: ScriptedAnswer = {
  question: "What should I know about Kartikey?",
  sentences: [
    say(
      "Kartikey is the founder of Karts, a self-hosted development platform that brings AI coding agents, persistent dev environments and app hosting into one workspace.",
      "karts.founder",
      "karts.what",
    ),
    say(
      "Kartikey is a 12x hackathon winner; the wins include two $1,000 Hexclave awards, at c0mpiled-11 with Cited and at c0mpiled-13 with Swiper No Swiping.",
      "zero-human-company-hackathon.count",
      "compiled-11.prize",
      "compiled-13.prize",
    ),
    say(
      "Re:Compress won Best Compression Model for The Token Company at the UC Berkeley AI Hackathon 2026, and the same work became the ReCompress preprint on Zenodo.",
      "berkeley-ai-hackathon-2026.prize",
      "berkeley-ai-hackathon-2026.paper",
    ),
    say(
      "Kartikey is the sole inventor and applicant on Indian Patent No. 558662, filed in October 2020 during high school and granted in January 2025.",
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
  step(
    6000,
    "Kartikey is the founder of Karts, a self-hosted development platform that brings AI coding agents, persistent dev environments and app hosting into one workspace.",
    "karts.founder",
    "karts.what",
  ),
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
    "Kartikey is the sole inventor and applicant on Indian Patent No. 558662, filed in October 2020 during high school and granted in January 2025.",
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
    "Two $1,000 Hexclave awards: at c0mpiled-11, the YC Startup School Hackathon, with Cited, and at c0mpiled-13, Startup School Hackathon II, with Swiper No Swiping.",
    "compiled-11.prize",
    "compiled-13.prize",
  ),
  step(
    5500,
    "Kartikey is a 12x hackathon winner; the twelfth win was 3rd place in Best use of Render at the Zero Human Company Hackathon by Terac, in August 2026, with AdLayer.",
    "zero-human-company-hackathon.count",
    "zero-human-company-hackathon.prize",
  ),
  step(
    5500,
    "As Founder & President of the Penn State Collegiate Hackathon Team, Kartikey lifted Penn State's national hackathon rank from #185 to #74 within one year.",
    "psu-hackathon-team.rank",
    "psu-hackathon-team.role",
  ),
  step(
    5000,
    "Kartikey has been Member of Technical Staff at Cara since June 2026, after a stint as Founding Engineer at Raya Health in the HF0 W26 residency batch.",
    "cara.role",
    "raya-health.role",
  ),
  step(
    5500,
    "Back to Karts, where Kartikey is the founder: a self-hosted development platform that brings AI coding agents, persistent dev environments and app hosting into one workspace.",
    "karts.founder",
    "karts.what",
  ),
];
