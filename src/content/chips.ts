import { MAX_STOPS, type AnswerSentence, type Chip, type FlightStop } from "@/lib/contract";

import { record } from "./record";
import { advocate, say } from "./scripts";

// Preset questions. Each chip carries curated sentences that cite the record,
// so a chip never calls the model, plus the V2 flight stops: each sentence's
// first citation (the star the camera visits), deduplicated, at most MAX_STOPS. Every fact and number in
// a sentence appears in the text of a facet it cites. Never mention age here.

function stopsOf(sentences: AnswerSentence[]): FlightStop[] {
  const seen = new Set<string>();
  const stops: FlightStop[] = [];
  for (const sentence of sentences) {
    const stop = sentence.citations[0];
    if (!stop || seen.has(stop.facetId)) continue;
    seen.add(stop.facetId);
    stops.push(stop);
  }
  return stops.slice(0, MAX_STOPS);
}

function chip(
  label: string,
  question: string,
  sentences: AnswerSentence[],
  view?: Chip["view"],
): Chip {
  return { label, question, stops: stopsOf(sentences), sentences, ...(view ? { view } : {}) };
}

/** The twelve hackathon wins, in the record's chronological order. */
const WIN_STAR_IDS = record.stars
  .filter((s) => s.constellation === "hackathons")
  .map((s) => s.id);

export const chips: Chip[] = [
  chip(advocate.question, advocate.question, advocate.sentences, advocate.view),

  chip("What is Karts?", "What is Karts?", [
    say(
      "Kartikey is the founder of Karts, a self-hosted development platform that brings AI coding agents, persistent dev environments and app hosting into one workspace.",
      "karts.founder",
      "karts.what",
    ),
    say(
      "Teams can coordinate coding agents, give each developer or branch its own services and data, and check environments against production.",
      "karts.capabilities",
    ),
    say(
      "Teams can catch outdated branches, simulate load, and publish applications on their own domains, all on infrastructure they control.",
      "karts.operations",
    ),
    say(
      "Karts helps startups build and ship software without having to assemble and maintain their own internal development platform.",
      "karts.why",
    ),
  ]),

  chip(
    "Built for AI agents",
    "What has Kartikey built for AI agents?",
    [
      say(
        "Kartikey's Multiverse is the branch predictor, but for tool calls: it forks into parallel sandboxed futures, commits one winner atomically and replays deterministically.",
        "multiverse.what",
      ),
      say(
        "PingPal is ambient messaging for CLI coders, published on npm: see teammates' ASCII faces and send 90-char pings inside Claude Code.",
        "pingpal.what",
        "pingpal.npm",
      ),
      say(
        "Hermes Offloader offloads work from your laptop to a cheap always-on server via /offload in Claude Code.",
        "hermes-offloader.what",
      ),
    ],
    { kind: "constellation", constellation: "agent-tools" },
  ),

  chip(
    "Hackathon wins",
    "Show me the hackathon wins",
    [
      say(
        "Kartikey is a 12x hackathon winner; AdLayer, in August 2026, was the twelfth win.",
        "zero-human-company-hackathon.count",
      ),
      say(
        "Two $1,000 Hexclave awards came at c0mpiled-11, the YC Startup School Hackathon, with Cited, and at c0mpiled-13, Startup School Hackathon II, with Swiper No Swiping.",
        "compiled-11.prize",
        "compiled-13.prize",
      ),
      say(
        "Re:Compress won Best Compression Model for The Token Company at the UC Berkeley AI Hackathon 2026.",
        "berkeley-ai-hackathon-2026.prize",
      ),
    ],
    { kind: "timeline", starIds: WIN_STAR_IDS },
  ),

  chip(
    "Research and patent",
    "What research has Kartikey published?",
    [
      say(
        "ReCompress is a Zenodo preprint of June 21, 2026, by Parth Sanjay Kshirsagar and Kartikey Pandey, on query-aware rewriting and tiered memory for efficient LLM context compression.",
        "recompress.preprint",
      ),
      say(
        "Its 1.5B student compresses HotpotQA context to about 3.5% of its tokens and still answers correctly, keeping the answer-bearing span where deletion truncates it.",
        "recompress.result",
      ),
      say(
        "Kartikey is the sole inventor and applicant on the patent, filed in October 2020 during high school; the grant was published on January 31, 2025.",
        "patent.inventor",
        "patent.timeline",
      ),
    ],
    { kind: "compare", starIds: ["recompress", "patent"] },
  ),

  chip("Where has Kartikey worked?", "Where has Kartikey worked?", [
    say("Kartikey has been Member of Technical Staff at Cara since June 2026.", "cara.role"),
    say(
      "Before that, Kartikey was Founding Engineer at Raya Health from February to May 2026, in the HF0 W26 residency batch.",
      "raya-health.role",
    ),
    say(
      "Earlier, Kartikey was a Software Engineer Intern at ColdStart from January to May 2025, in State College, PA.",
      "coldstart.role",
    ),
    say(
      "At Intel Corporation, Kartikey was Internship Trainee from August 2020 to May 2021, then Apprentice from May to July 2021.",
      "intel.role",
    ),
  ]),
];
