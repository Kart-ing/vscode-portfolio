// The one planner instance a server process uses, built from the real record
// and chips. Budgets and the cache live for the life of the process.

import { chips } from "@/content/chips";
import { record } from "@/content/record";
import { createFlightPlanner, type FlightPlanner } from "./planner";

let instance: FlightPlanner | undefined;

export function getDefaultPlanner(): FlightPlanner {
  instance ??= createFlightPlanner({ record, chips });
  return instance;
}
