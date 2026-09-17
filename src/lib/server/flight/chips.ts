// Preset questions answer instantly with their fixed plan and no model call.

import type { Chip } from "@/lib/contract";
import { normalizeQuestion } from "./text";

interface ChipIndex {
  byKey: Map<string, Chip>;
}

const indexes = new WeakMap<readonly Chip[], ChipIndex>();

function indexChips(chips: readonly Chip[]): ChipIndex {
  const cached = indexes.get(chips);
  if (cached) return cached;
  const byKey = new Map<string, Chip>();
  for (const chip of chips) {
    for (const key of [normalizeQuestion(chip.question), normalizeQuestion(chip.label)]) {
      if (key && !byKey.has(key)) byKey.set(key, chip);
    }
  }
  const index = { byKey };
  indexes.set(chips, index);
  return index;
}

/** Finds the chip whose normalized question or label equals `normalized`. */
export function matchChip(normalized: string, chips: readonly Chip[]): Chip | undefined {
  if (!normalized) return undefined;
  return indexChips(chips).byKey.get(normalized);
}
