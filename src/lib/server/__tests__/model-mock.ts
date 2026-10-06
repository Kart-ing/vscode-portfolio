// A fake OpenRouter for the answer tests: SSE streams built from a scripted
// model reply, delivered in small chunks so lines and JSON split anywhere. No
// test that uses these touches the network.

import { vi } from "vitest";

export type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

export interface StreamOpts {
  deltaSize?: number;
  chunkSize?: number;
  /** Send the closing [DONE] event. */
  done?: boolean;
  /** The model OpenRouter reports as the one that answered. */
  model?: string;
}

export function sseText(deltas: readonly string[], done = true, model = "z-ai/glm-5.2:free"): string {
  const parts = [": OPENROUTER PROCESSING\n\n"];
  for (const delta of deltas) {
    parts.push(
      `data: ${JSON.stringify({ id: "gen", model, choices: [{ index: 0, delta: { role: "assistant", content: delta }, finish_reason: null }] })}\n\n`,
    );
  }
  if (done) parts.push("data: [DONE]\n\n");
  return parts.join("");
}

/** Bytes delivered in fixed-size chunks. */
export function byteStream(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

export function modelStream(output: string, opts: StreamOpts = {}): Response {
  const deltaSize = opts.deltaSize ?? 5;
  const deltas: string[] = [];
  for (let i = 0; i < output.length; i += deltaSize) deltas.push(output.slice(i, i + deltaSize));
  return new Response(byteStream(sseText(deltas, opts.done ?? true, opts.model), opts.chunkSize ?? 7), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

/** A model that always replies with `output`, whatever it was asked. */
export const modelFetch = (output: string, opts?: StreamOpts): FetchMock => vi.fn(async () => modelStream(output, opts));

/** The candidate ids the server offered, read back from the request's user message. */
export function offeredIds(init: RequestInit | undefined): string[] {
  const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: { role: string; content: string }[] };
  const user = body.messages?.find((m) => m.role === "user")?.content ?? "";
  return user
    .split("\n")
    .map((row) => /^([a-z0-9-]+\.[a-z0-9-]+) \| /.exec(row)?.[1])
    .filter((id): id is string => !!id);
}

/** A model that replies {"ids": pick(offered)}: a well-behaved model, or one that picks badly on purpose. */
export function pickingFetch(pick: (offered: string[]) => readonly unknown[], opts?: StreamOpts): FetchMock {
  return vi.fn(async (_url, init) => modelStream(JSON.stringify({ ids: pick(offeredIds(init)) }), opts));
}

/** A stream that sends `prefix` then stalls until the request is aborted, as a timeout does. */
export function stallingFetch(prefix: string): FetchMock {
  return vi.fn(async (_url, init) => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseText([prefix], false)));
        init?.signal?.addEventListener("abort", () => {
          controller.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
}
