"use client";

import { chips } from "@/content/chips";
import { advocate, tour } from "@/content/scripts";
import type { Chip } from "@/lib/contract";
import { useFlight } from "@/lib/flight-state";

function key(question: string): string {
  return question.toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/, "").trim();
}

// "Should we hire Kartikey?" always leads. If the content lists it as a chip
// its label wins; otherwise the scripted answer supplies the chip itself.
const fromContent = chips.find((chip) => key(chip.question) === key(advocate.question));
const advocateChip: Chip = {
  label: fromContent?.label ?? advocate.question,
  question: advocate.question,
  stops: advocate.sentences.flatMap((sentence) => sentence.citations.slice(0, 1)),
  sentences: advocate.sentences,
  view: advocate.view,
};
const ordered: Chip[] = [advocateChip, ...chips.filter((chip) => key(chip.question) !== key(advocate.question))];

// Preset questions. A chip plays its curated sentences locally and never calls the API.
export function Chips({ className, withTour = true }: { className?: string; withTour?: boolean }) {
  const { askChip, startTour } = useFlight();
  return (
    <div className={className ? `chips ${className}` : "chips"} role="group" aria-label="Preset questions">
      {ordered.map((chip, i) => (
        <button
          key={chip.question}
          type="button"
          className={i === 0 ? "chip chip-advocate" : "chip"}
          onClick={() => askChip(chip)}
        >
          {i === 0 && (
            <span className="chip-spark" aria-hidden="true">
              ✦
            </span>
          )}
          {chip.label}
        </button>
      ))}
      {withTour && tour.length > 0 && (
        <button type="button" className="chip chip-tour" onClick={startTour}>
          Take the tour
          <span className="arrow" aria-hidden="true">
            ▸
          </span>
        </button>
      )}
    </div>
  );
}
