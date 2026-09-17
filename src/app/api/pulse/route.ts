// GET /api/pulse: RepoPulse[] for stars with a repo, from GitHub, cached for
// 15 minutes in memory. Always HTTP 200 and always an array; [] on failure.
// See src/lib/server/pulse/github.ts.

import { getDefaultPulseSource } from "@/lib/server/pulse/default";

export async function GET(): Promise<Response> {
  let pulses: unknown[] = [];
  try {
    pulses = await getDefaultPulseSource().getPulses();
  } catch {
    pulses = [];
  }
  return Response.json(pulses, {
    status: 200,
    headers: { "Cache-Control": "public, s-maxage=900" },
  });
}
