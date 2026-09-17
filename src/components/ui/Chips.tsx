"use client";

import { chips } from "@/content/chips";
import { useFlight } from "@/lib/flight-state";

// Preset questions. A chip sets its fixed plan directly and never calls the API.
export function Chips({ className }: { className?: string }) {
  const { askChip } = useFlight();
  if (chips.length === 0) return null;
  return (
    <div className={className ? `chips ${className}` : "chips"} role="group" aria-label="Preset questions">
      {chips.map((chip) => (
        <button
          key={chip.question}
          type="button"
          className="chip"
          onClick={() => askChip(chip)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
