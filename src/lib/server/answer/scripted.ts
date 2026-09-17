// Turns curated content (the advocate answer, the highlights, a chip) into
// answer events. Copies everything so content objects never leak out mutable.

import type {
  AnswerEvent,
  AnswerSentence,
  Chip,
  Facet,
  GeneratedView,
  ScriptedAnswer,
} from "@/lib/contract";

export function copyView(view: GeneratedView): GeneratedView {
  return view.kind === "constellation"
    ? { kind: "constellation", constellation: view.constellation }
    : { kind: view.kind, starIds: [...view.starIds] };
}

export function copySentence(sentence: AnswerSentence): AnswerSentence {
  return {
    text: sentence.text,
    citations: sentence.citations.map((c) => ({ starId: c.starId, facetId: c.facetId })),
  };
}

/** The view (if any) then every sentence of a scripted answer. */
export function scriptedEvents(script: ScriptedAnswer): AnswerEvent[] {
  const events: AnswerEvent[] = [];
  if (script.view) events.push({ type: "view", view: copyView(script.view) });
  for (const sentence of script.sentences) {
    events.push({ type: "say", sentence: copySentence(sentence) });
  }
  return events;
}

/**
 * A chip's curated sentences and view. A V2 chip without sentences narrates
 * each stop with the facet's own text, so every chip still speaks.
 */
export function chipEvents(chip: Chip, facets: ReadonlyMap<string, Facet>): AnswerEvent[] {
  const events: AnswerEvent[] = [];
  if (chip.view) events.push({ type: "view", view: copyView(chip.view) });
  if (chip.sentences && chip.sentences.length > 0) {
    for (const sentence of chip.sentences) events.push({ type: "say", sentence: copySentence(sentence) });
    return events;
  }
  for (const stop of chip.stops) {
    const facet = facets.get(stop.facetId);
    if (!facet || facet.starId !== stop.starId) continue;
    events.push({
      type: "say",
      sentence: { text: facet.text, citations: [{ starId: stop.starId, facetId: stop.facetId }] },
    });
  }
  return events;
}
