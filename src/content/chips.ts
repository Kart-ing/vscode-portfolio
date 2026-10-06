import { MAX_STOPS, type AnswerSentence, type Chip, type FlightStop } from "@/lib/contract";

import { C11, C2, C5A } from "./canonical";
import { record } from "./record";
import { advocate, say } from "./scripts";

// Preset questions. Each chip carries curated sentences that cite the record,
// so a chip never calls the model, plus the V2 flight stops: each sentence's
// first citation (the star the camera visits), deduplicated, at most MAX_STOPS. Every fact and number in
// a sentence appears in the text of a facet it cites. Role facts appear only as
// the C11 sentences, verbatim. Never mention age here.

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

/** The hackathon prize stars, in the record's chronological order. */
const PRIZE_STAR_IDS = record.stars
  .filter((s) => s.constellation === "hackathons")
  .map((s) => s.id);

export const chips: Chip[] = [
  chip(advocate.question, advocate.question, advocate.sentences, advocate.view),

  chip("What is Karts?", "What is Karts?", [
    say(C11.karts, "karts.founder"),
    say(C2, "karts.what"),
    say(C5A, "karts.traction"),
  ]),

  chip(
    "Built for AI agents",
    "What has Kartikey built for AI agents?",
    [
      say(
        "Kartikey and two teammates built Multiverse: the branch predictor, but for tool calls.",
        "multiverse.team",
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
    "Hackathon prizes",
    "Show me the hackathon prizes",
    [
      say(
        "Kartikey has won 13 prizes at 12 hackathons; the latest was AdLayer, in August 2026.",
        "zero-human-company-hackathon.count",
      ),
      say(
        "Two $1,000 Hexclave awards came at c0mpiled-11, a hackathon hosted by Transpose during YC Startup School weekend, with Cited, and at c0mpiled-13, Startup School Hackathon II, with Swiper No Swiping.",
        "compiled-11.prize",
        "compiled-13.prize",
      ),
      say(
        "Re:Compress, built with Parth Kshirsagar, won The Token Company's Best Compression Model prize at the UC Berkeley AI Hackathon 2026.",
        "berkeley-ai-hackathon-2026.prize",
      ),
    ],
    { kind: "timeline", starIds: PRIZE_STAR_IDS },
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
        "Kartikey is the sole inventor and applicant on the patent, filed in October 2020 during high school; the grant was published on January 31, 2025, and the patent has since lapsed.",
        "patent.inventor",
        "patent.timeline",
      ),
    ],
    { kind: "compare", starIds: ["recompress", "patent"] },
  ),

  chip("Where has Kartikey worked?", "Where has Kartikey worked?", [
    say(C11.cara, "cara.role"),
    say(C11.raya, "raya-health.role"),
    say(C11.coldstart, "coldstart.role"),
    say(C11.intel, "intel.role"),
  ]),
];
