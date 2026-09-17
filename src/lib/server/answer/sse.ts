// Incremental parsers for the model stream. SseParser turns raw text chunks
// into `data:` payloads (a chunk may end mid-line, even mid-JSON), and
// LineSplitter turns content deltas into protocol lines (a line may arrive
// across many deltas, even mid-marker). Both are pure and never throw.

export type SseEvent = { kind: "data"; data: string } | { kind: "done" };

export class SseParser {
  private buffer = "";

  /** Feeds a chunk and returns every complete `data:` event it completed. */
  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const events: SseEvent[] = [];
    let newline = this.buffer.indexOf("\n");
    while (newline !== -1) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      const event = parseSseLine(line);
      if (event) events.push(event);
      newline = this.buffer.indexOf("\n");
    }
    return events;
  }

  /** Parses whatever is left when the body ends without a trailing newline. */
  flush(): SseEvent[] {
    const rest = this.buffer;
    this.buffer = "";
    const event = parseSseLine(rest);
    return event ? [event] : [];
  }
}

/** One SSE line. Comments (": ..."), `event:`, `id:` and blank lines carry nothing here. */
function parseSseLine(rawLine: string): SseEvent | null {
  const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
  if (!line.startsWith("data:")) return null;
  // The SSE spec strips exactly one leading space after the colon.
  let data = line.slice(5);
  if (data.startsWith(" ")) data = data.slice(1);
  data = data.trimEnd();
  if (data === "[DONE]") return { kind: "done" };
  if (data === "") return null;
  return { kind: "data", data };
}

export interface ChunkInfo {
  /** Text of choices[0].delta.content, or "" when the chunk carries none. */
  content: string;
  finishReason: string | null;
  /** The model that answered, as OpenRouter reports it on each chunk. */
  model?: string;
  /** Set when the provider reports an error inside the stream. */
  error?: { code?: number; message?: string };
}

/** Reads one chat-completion chunk. Returns null for JSON that is not an object. */
export function parseChunk(data: string): ChunkInfo | null {
  let body: unknown;
  try {
    body = JSON.parse(data);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const record = body as {
    choices?: unknown;
    model?: unknown;
    error?: { code?: unknown; message?: unknown } | null;
  };
  const info: ChunkInfo = { content: "", finishReason: null };
  if (typeof record.model === "string" && record.model) info.model = record.model;
  if (record.error && typeof record.error === "object") {
    info.error = {
      code: typeof record.error.code === "number" ? record.error.code : undefined,
      message: typeof record.error.message === "string" ? record.error.message : undefined,
    };
  }
  if (Array.isArray(record.choices) && record.choices.length > 0) {
    const first = record.choices[0] as {
      delta?: { content?: unknown } | null;
      finish_reason?: unknown;
    } | null;
    const content = first?.delta?.content;
    if (typeof content === "string") info.content = content;
    if (typeof first?.finish_reason === "string") info.finishReason = first.finish_reason;
  }
  return info;
}

/** Accumulates text deltas and hands back complete lines, without their newline. */
export class LineSplitter {
  private buffer = "";

  push(text: string): string[] {
    this.buffer += text;
    const lines: string[] = [];
    let newline = this.buffer.indexOf("\n");
    while (newline !== -1) {
      lines.push(this.buffer.slice(0, newline));
      this.buffer = this.buffer.slice(newline + 1);
      newline = this.buffer.indexOf("\n");
    }
    return lines;
  }

  /** The unterminated tail, if any; a model often ends without a final newline. */
  flush(): string | null {
    const rest = this.buffer;
    this.buffer = "";
    return rest.trim() ? rest : null;
  }
}
