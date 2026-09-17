// Turns a planner into a Web-standard POST handler. Never throws and never
// returns a status other than 200; the plan itself carries the outcome.

import type { FlightPlan } from "@/lib/contract";
import { clientKeyFromHeaders } from "./budgets";
import type { FlightPlanner } from "./planner";
import { EMPTY_PLAN, readQuestion } from "./validate";

export function createFlightHandler(
  planner: FlightPlanner,
  log: (message: string) => void = (message) => console.warn(message),
): (request: Request) => Promise<Response> {
  return async function POST(request: Request): Promise<Response> {
    let plan: FlightPlan = { ...EMPTY_PLAN, stops: [] };
    try {
      const rawQuestion = await readQuestion(request);
      plan = await planner.plan(rawQuestion, clientKeyFromHeaders(request.headers));
    } catch (error) {
      log(`[flight] handler error: ${error instanceof Error ? error.name : "unknown"}`);
    }
    return Response.json(plan, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  };
}
