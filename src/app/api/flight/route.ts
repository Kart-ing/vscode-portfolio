// POST /api/flight: {question} in, FlightPlan out. Always HTTP 200; the plan's
// mode says how it was produced. See src/lib/server/flight/planner.ts.

import { getDefaultPlanner } from "@/lib/server/flight/default";
import { createFlightHandler } from "@/lib/server/flight/handler";

const handler = createFlightHandler(getDefaultPlanner());

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}
