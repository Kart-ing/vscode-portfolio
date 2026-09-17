// POST /api/answer: {question} in, NDJSON out (one AnswerEvent per line,
// ending with "done"). Always HTTP 200; the done event's mode says how the
// answer was produced. See src/lib/server/answer/answerer.ts.

import { getDefaultAnswerer } from "@/lib/server/answer/default";
import { createAnswerHandler } from "@/lib/server/answer/handler";

const handler = createAnswerHandler(getDefaultAnswerer());

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}
