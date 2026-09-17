// Turns an answerer into a Web-standard POST handler that streams NDJSON:
// one AnswerEvent per line, each flushed as soon as it exists. Never throws,
// never returns a status other than 200, and always ends with a `done` line.

import type { AnswerEvent } from "@/lib/contract";
import { clientKeyFromHeaders } from "@/lib/server/flight/budgets";
import { readQuestion } from "@/lib/server/flight/validate";
import type { Answerer } from "./answerer";

export const NDJSON_CONTENT_TYPE = "application/x-ndjson";

export function createAnswerHandler(
  answerer: Answerer,
  log: (message: string) => void = (message) => console.warn(message),
): (request: Request) => Promise<Response> {
  return async function POST(request: Request): Promise<Response> {
    let rawQuestion: unknown = null;
    let clientKey = "unknown";
    try {
      rawQuestion = await readQuestion(request);
      clientKey = clientKeyFromHeaders(request.headers);
    } catch (error) {
      log(`[answer] request error: ${error instanceof Error ? error.name : "unknown"}`);
    }

    const encoder = new TextEncoder();
    const abort = new AbortController();
    let iterator: AsyncGenerator<AnswerEvent, void, undefined> | undefined;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let open = true;
        let sawDone = false;
        let sawSay = false;
        const write = (event: AnswerEvent) => {
          if (!open) return;
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            open = false;
          }
        };
        try {
          iterator = answerer.answer(rawQuestion, clientKey, abort.signal);
          for await (const event of iterator) {
            if (event.type === "done") sawDone = true;
            if (event.type === "say") sawSay = true;
            write(event);
            if (!open) break;
          }
        } catch (error) {
          log(`[answer] handler error: ${error instanceof Error ? error.name : "unknown"}`);
        }
        if (!sawDone) write({ type: "done", mode: sawSay ? "local" : "none" });
        try {
          controller.close();
        } catch {
          // Already closed by a cancel.
        }
      },
      cancel() {
        abort.abort();
        void iterator?.return(undefined).catch(() => {});
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": NDJSON_CONTENT_TYPE,
        "Cache-Control": "no-store",
        // Ask buffering proxies to pass each line through as it is written.
        "X-Accel-Buffering": "no",
      },
    });
  };
}
