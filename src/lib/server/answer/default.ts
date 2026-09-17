// The one answerer a server process uses, built from the real record, chips
// and scripts. Budgets and the cache live for the life of the process.

import { chips } from "@/content/chips";
import { record } from "@/content/record";
import { advocate, highlights } from "@/content/scripts";
import { createAnswerer, type Answerer } from "./answerer";

let instance: Answerer | undefined;

export function getDefaultAnswerer(): Answerer {
  instance ??= createAnswerer({ record, chips, advocate, highlights });
  return instance;
}
