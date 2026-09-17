// Live evaluation of the streaming answer pipeline against OpenRouter.
// Skipped unless OPENROUTER_API_KEY is set:
//   OPENROUTER_API_KEY=... npx vitest run src/lib/server/__tests__/answer-eval.test.ts
// It spends up to 2 free-tier requests, so run it deliberately. With
// ANSWER_EVAL_OUT set, a transcript (events and server log lines, never the
// key) is appended to that file.

import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AnswerEvent } from "@/lib/contract";
import { chips } from "@/content/chips";
import { record } from "@/content/record";
import { advocate, highlights } from "@/content/scripts";
import { createAnswerer } from "@/lib/server/answer/answerer";

const apiKey = process.env.OPENROUTER_API_KEY?.trim();

const QUESTIONS = ["What has Kartikey built with TypeScript?", "Compare Karts and Multiverse."];

describe.skipIf(!apiKey)("answer eval (live OpenRouter)", () => {
  it("streams the questions through the free model chain and always ends with done", async () => {
    const logs: string[] = [];
    const answerer = createAnswerer({
      record,
      chips,
      advocate,
      highlights,
      getApiKey: () => apiKey,
      perClientLimit: QUESTIONS.length,
      log: (message) => logs.push(message),
    });
    const rows: string[] = [];
    for (const question of QUESTIONS) {
      const started = Date.now();
      const events: AnswerEvent[] = [];
      for await (const event of answerer.answer(question, "eval")) events.push(event);
      const done = events[events.length - 1];
      expect(done.type).toBe("done");
      if (done.type !== "done") continue;
      expect(["model", "local", "cache"]).toContain(done.mode);
      const says = events.flatMap((e) => (e.type === "say" ? [e.sentence] : []));
      expect(says.length).toBeGreaterThan(0);
      for (const sentence of says) {
        for (const citation of sentence.citations) {
          expect(record.facets.some((f) => f.id === citation.facetId && f.starId === citation.starId)).toBe(true);
        }
      }
      rows.push(`Q: ${question}`);
      rows.push(
        `  mode=${done.mode} says=${says.length} view=${events.some((e) => e.type === "view")} beams=${events.some((e) => e.type === "beams")} ms=${Date.now() - started}`,
      );
      for (const event of events) {
        if (event.type === "view") rows.push(`  view: ${JSON.stringify(event.view)}`);
        if (event.type === "say") {
          rows.push(`  - ${event.sentence.text} [${event.sentence.citations.map((c) => c.facetId).join(", ")}]`);
        }
      }
      for (const line of logs.splice(0)) rows.push(`  log: ${line}`);
    }
    const out = process.env.ANSWER_EVAL_OUT;
    if (out) appendFileSync(out, `${rows.join("\n")}\n`);
  }, 5 * 60 * 1000);
});
