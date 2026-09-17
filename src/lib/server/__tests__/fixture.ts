// A small record for server tests. Nothing here needs to be true; it only has
// to look like the real record so tests stay stable while the content changes.
// V3 adds start, stack and repo metadata, facets that carry numbers for the
// truth rules, and scripted answers.

import type { Chip, ScriptedAnswer, WorkRecord } from "@/lib/contract";

export const fixtureRecord: WorkRecord = {
  owner: {
    name: "Test Owner",
    role: "Founder, Karts",
    tagline: "Karts is the IDE and coding servers for startups.",
    links: [{ label: "GitHub", url: "https://github.com/example" }],
  },
  constellations: [
    { id: "building", label: "Building" },
    { id: "agent-tools", label: "Agent tools" },
    { id: "research", label: "Research" },
    { id: "hackathons", label: "Hackathons" },
    { id: "work", label: "Work" },
    { id: "leadership", label: "Leadership" },
    { id: "education", label: "Education" },
  ],
  stars: [
    {
      id: "karts",
      label: "Karts",
      constellation: "building",
      kind: "company",
      period: "2026",
      start: "2026-01",
      stack: ["TypeScript", "Go", "Postgres", "Node.js"],
      summary: "Karts is the IDE and coding servers for startups.",
      tags: ["karts", "startup", "ide", "coding servers", "founder", "company"],
      links: [{ label: "Site", url: "https://example.com/karts" }],
      weight: 3,
    },
    {
      id: "multiverse",
      label: "Multiverse",
      constellation: "agent-tools",
      kind: "project",
      period: "2026",
      start: "2026-06",
      stack: ["Python", "SQLite"],
      repo: "example/multiverse",
      summary: "A speculative execution harness for AI agents.",
      tags: ["multiverse", "agents", "sandbox", "tool calls"],
      links: [{ label: "GitHub", url: "https://github.com/example/multiverse" }],
      weight: 2,
    },
    {
      id: "patent",
      label: "Patent No. 558662",
      constellation: "research",
      kind: "patent",
      period: "Filed 2020, granted 2025",
      start: "2020-10",
      summary: "Indian Patent No. 558662, System and Method Providing Data Conversion.",
      tags: ["patent", "compression", "16"],
      links: [],
      weight: 2,
    },
    {
      id: "signal-paper",
      label: "Signal compression paper",
      constellation: "research",
      kind: "paper",
      period: "2024",
      start: "2024-03",
      summary: "A peer-reviewed paper on lossless signal compression.",
      tags: ["paper", "publication", "compression", "ieee"],
      links: [{ label: "DOI", url: "https://doi.org/10.0000/example" }],
      weight: 1,
    },
    {
      id: "hackmit",
      label: "HackMIT 2025",
      constellation: "hackathons",
      kind: "award",
      period: "Sep 2025",
      start: "2025-09",
      stack: ["Python", "React", "Lens Studio"],
      repo: "example/voice-agent",
      summary: "Grand prize at HackMIT 2025 for a voice agent.",
      tags: ["hackathon", "hackmit", "grand prize", "winner"],
      links: [{ label: "Devpost", url: "https://devpost.com/example" }],
      weight: 2,
    },
    {
      id: "acme",
      label: "Acme Labs",
      constellation: "work",
      kind: "role",
      period: "Summer 2025",
      start: "2025-06",
      stack: ["Go", "Kubernetes"],
      summary: "Software engineering intern on the infrastructure team.",
      tags: ["acme labs", "internship", "software engineer", "infrastructure"],
      links: [],
      weight: 1,
    },
    {
      id: "robotics-club",
      label: "Robotics Club",
      constellation: "leadership",
      kind: "community",
      period: "2023 – 2025",
      start: "2023-09",
      repo: "example/robotics",
      summary: "President of the campus robotics club.",
      tags: ["robotics", "club", "president"],
      links: [],
      weight: 1,
    },
    {
      id: "state-u",
      label: "State University",
      constellation: "education",
      kind: "education",
      period: "2022 – 2026",
      start: "2022-08",
      summary: "B.S. in Computer Science.",
      tags: ["computer science", "bs", "university"],
      links: [],
      weight: 1,
    },
  ],
  facets: [
    {
      id: "karts.what",
      starId: "karts",
      text: "Karts is the IDE and coding servers for startups, built for enterprise compliance without losing startup speed.",
    },
    {
      id: "karts.customers",
      starId: "karts",
      text: "Karts is sold as SaaS and under licence to teams that run their own servers.",
    },
    {
      id: "multiverse.what",
      starId: "multiverse",
      text: "The branch predictor, but for tool calls: fork into parallel sandboxed futures, commit one winner atomically.",
    },
    {
      id: "patent.what",
      starId: "patent",
      text: "Sole inventor on Indian Patent No. 558662, filed in 2020 and granted in 2025.",
      source: { label: "Patent record", url: "https://example.com/patent" },
    },
    {
      id: "signal-paper.what",
      starId: "signal-paper",
      text: "First author of a paper on lossless signal compression, published at an IEEE conference in 2024.",
    },
    {
      id: "hackmit.win",
      starId: "hackmit",
      text: "Won the grand prize at HackMIT 2025 with a voice agent built in 24 hours.",
    },
    {
      id: "acme.role",
      starId: "acme",
      text: "Worked as a software engineering intern at Acme Labs on the infrastructure team in summer 2025.",
    },
    {
      id: "robotics-club.lead",
      starId: "robotics-club",
      text: "Led the campus robotics club as president for two years.",
    },
    {
      id: "state-u.degree",
      starId: "state-u",
      text: "Studying for a B.S. in Computer Science at State University, class of 2026.",
    },
    // V3: facets that carry numbers and name technologies.
    {
      id: "multiverse.stack",
      starId: "multiverse",
      text: "Written in Python 3.11 with SQLite copy-on-write branching.",
    },
    {
      id: "hackmit.team",
      starId: "hackmit",
      text: "Kartikey led a group of 4 that placed #1 of 185 entries; the demo ran a 1.5B model at 3.5% of the tokens.",
    },
    {
      id: "acme.impact",
      starId: "acme",
      text: "Cut deployment time by 33%, from 3 days to 2, and handled 1,000+ specs a day at 97% accuracy.",
    },
    {
      id: "robotics-club.growth",
      starId: "robotics-club",
      text: "Grew the club 12x to 240 members and raised $1,000 in sponsorships, lifting its rank from #185 to #74.",
    },
    {
      id: "karts.since",
      starId: "karts",
      text: "Karts has shipped weekly since 2026.",
    },
    // V3: a technology named only in a facet's text, and a facet that only
    // quotes where a fact came from.
    {
      id: "robotics-club.site",
      starId: "robotics-club",
      text: "Built the club site in TypeScript with a small Node.js backend.",
    },
    {
      id: "hackmit.tagline",
      starId: "hackmit",
      text: 'Devpost tagline: "A voice agent that books restaurant tables by phone."',
    },
  ],
};

export const fixtureChips: Chip[] = [
  {
    label: "What's Karts?",
    question: "What is Karts?",
    stops: [{ starId: "karts", facetId: "karts.what" }],
  },
  {
    label: "What did you build in high school?",
    question: "What did you build in high school?",
    stops: [{ starId: "patent", facetId: "patent.what" }],
  },
  // V3: a chip with curated narration and a staged view.
  {
    label: "Research and patent",
    question: "What research has Kartikey published?",
    stops: [
      { starId: "signal-paper", facetId: "signal-paper.what" },
      { starId: "patent", facetId: "patent.what" },
    ],
    sentences: [
      {
        text: "Kartikey is first author of an IEEE paper on lossless signal compression.",
        citations: [{ starId: "signal-paper", facetId: "signal-paper.what" }],
      },
      {
        text: "Kartikey is the sole inventor on Indian Patent No. 558662.",
        citations: [{ starId: "patent", facetId: "patent.what" }],
      },
    ],
    view: { kind: "constellation", constellation: "research" },
  },
];

export const fixtureAdvocate: ScriptedAnswer = {
  question: "Should we hire Kartikey?",
  view: { kind: "compare", starIds: ["karts", "hackmit"] },
  sentences: [
    { text: "Yes.", citations: [] },
    {
      text: "Kartikey is building Karts, the IDE and coding servers for startups.",
      citations: [{ starId: "karts", facetId: "karts.what" }],
    },
    {
      text: "Kartikey won the grand prize at HackMIT 2025 with a voice agent built in 24 hours.",
      citations: [{ starId: "hackmit", facetId: "hackmit.win" }],
    },
    {
      text: "Kartikey is the sole inventor on Indian Patent No. 558662.",
      citations: [{ starId: "patent", facetId: "patent.what" }],
    },
  ],
};

export const fixtureHighlights: ScriptedAnswer = {
  question: "What should I know about Kartikey?",
  sentences: [
    {
      text: "Kartikey is the founder of Karts, the IDE and coding servers for startups.",
      citations: [{ starId: "karts", facetId: "karts.what" }],
    },
    {
      text: "Kartikey won the grand prize at HackMIT 2025.",
      citations: [{ starId: "hackmit", facetId: "hackmit.win" }],
    },
  ],
};
