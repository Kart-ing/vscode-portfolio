import type { Chip } from "@/lib/contract";

// Preset questions. Each has a fixed plan of 1-4 stops that exist in the
// record, so a chip never calls the model. Never mention age here.
export const chips: Chip[] = [
  {
    label: "What is Karts?",
    question: "What is Karts?",
    stops: [{ starId: "karts", facetId: "karts.what" }],
  },
  {
    label: "Built for AI agents",
    question: "What has Kartikey built for AI agents?",
    stops: [
      { starId: "multiverse", facetId: "multiverse.what" },
      { starId: "pingpal", facetId: "pingpal.what" },
      { starId: "hermes-offloader", facetId: "hermes-offloader.what" },
    ],
  },
  {
    label: "Hackathon wins",
    question: "Show me the hackathon wins",
    stops: [
      { starId: "berkeley-ai-hackathon-2026", facetId: "berkeley-ai-hackathon-2026.prize" },
      { starId: "calhacks-12", facetId: "calhacks-12.prize" },
      { starId: "compiled-11", facetId: "compiled-11.prize" },
      { starId: "hackpsu-fall-2024", facetId: "hackpsu-fall-2024.prize" },
    ],
  },
  {
    label: "Research and patent",
    question: "What research has Kartikey published?",
    stops: [
      { starId: "recompress", facetId: "recompress.preprint" },
      { starId: "patent", facetId: "patent.what" },
    ],
  },
  {
    label: "Work history",
    question: "Where has Kartikey worked?",
    stops: [
      { starId: "cara", facetId: "cara.role" },
      { starId: "raya-health", facetId: "raya-health.role" },
      { starId: "coldstart", facetId: "coldstart.role" },
      { starId: "intel", facetId: "intel.role" },
    ],
  },
  {
    label: "Penn State",
    question: "What did Kartikey do at Penn State?",
    stops: [
      { starId: "psu-hackathon-team", facetId: "psu-hackathon-team.rank" },
      { starId: "gdsc-psu", facetId: "gdsc-psu.community" },
      { starId: "penn-state", facetId: "penn-state.degree" },
    ],
  },
];
