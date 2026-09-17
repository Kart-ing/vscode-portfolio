import { describe, expect, it } from "vitest";
import { LineSplitter, SseParser, parseChunk } from "@/lib/server/answer/sse";

const chunk = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\n`;

const contents = (events: ReturnType<SseParser["push"]>) =>
  events.map((e) => (e.kind === "data" ? parseChunk(e.data)?.content : "[DONE]"));

describe("SseParser", () => {
  it("parses data lines and [DONE], skipping comments", () => {
    const parser = new SseParser();
    const events = parser.push(`: OPENROUTER PROCESSING\n\n${chunk("SAY")}data: [DONE]\n\n`);
    expect(contents(events)).toEqual(["SAY", "[DONE]"]);
  });

  it("joins a line split across chunks at any byte, even inside the JSON", () => {
    const text = chunk("SAY Kartikey") + chunk(" [karts.what]") + "data: [DONE]\n\n";
    for (const size of [1, 2, 3, 7, 13, 50, 1000]) {
      const parser = new SseParser();
      const events = [];
      for (let i = 0; i < text.length; i += size) events.push(...parser.push(text.slice(i, i + size)));
      events.push(...parser.flush());
      expect(contents(events), `chunk size ${size}`).toEqual(["SAY Kartikey", " [karts.what]", "[DONE]"]);
    }
  });

  it("accepts CRLF, no space after the colon and a tail without a newline", () => {
    const parser = new SseParser();
    const events = [
      ...parser.push('data:{"choices":[{"delta":{"content":"a"}}]}\r\n\r\ndata: [DONE]'),
      ...parser.flush(),
    ];
    expect(events).toEqual([{ kind: "data", data: '{"choices":[{"delta":{"content":"a"}}]}' }, { kind: "done" }]);
    expect(parser.flush()).toEqual([]);
  });

  it("ignores event, id and comment lines and empty data", () => {
    const parser = new SseParser();
    expect(parser.push("event: message\nid: 1\n: keepalive\ndata:\ndata: \n\n")).toEqual([]);
  });
});

describe("parseChunk", () => {
  it("reads content, finish_reason and in-stream errors", () => {
    expect(parseChunk(JSON.stringify({ choices: [{ delta: { content: "hi" }, finish_reason: null }] }))).toEqual({
      content: "hi",
      finishReason: null,
    });
    expect(parseChunk(JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] }))).toEqual({
      content: "",
      finishReason: "stop",
    });
    expect(parseChunk(JSON.stringify({ error: { code: 429, message: "slow down" } }))).toEqual({
      content: "",
      finishReason: null,
      error: { code: 429, message: "slow down" },
    });
  });

  it("returns null for non-JSON and non-objects", () => {
    expect(parseChunk("not json")).toBeNull();
    expect(parseChunk("42")).toBeNull();
    expect(parseChunk("null")).toBeNull();
    expect(parseChunk('"text"')).toBeNull();
  });

  it("ignores reasoning deltas and non-string content", () => {
    expect(parseChunk(JSON.stringify({ choices: [{ delta: { reasoning: "thinking", content: null } }] }))).toEqual({
      content: "",
      finishReason: null,
    });
    expect(parseChunk(JSON.stringify({ choices: [] }))).toEqual({ content: "", finishReason: null });
  });
});

describe("LineSplitter", () => {
  it("returns complete lines and keeps the rest", () => {
    const splitter = new LineSplitter();
    expect(splitter.push("VIEW timeline a b\nSAY one [x.y]\nSAY tw")).toEqual(["VIEW timeline a b", "SAY one [x.y]"]);
    expect(splitter.push("o [x.z]\nEND")).toEqual(["SAY two [x.z]"]);
    expect(splitter.flush()).toBe("END");
    expect(splitter.flush()).toBeNull();
  });

  it("reassembles a line and a citation marker split across many deltas", () => {
    const splitter = new LineSplitter();
    const deltas = ["SA", "Y Kart", "ikey built Karts [ka", "rts.wh", "at]\nEN", "D\n"];
    expect(deltas.flatMap((d) => splitter.push(d))).toEqual(["SAY Kartikey built Karts [karts.what]", "END"]);
    expect(splitter.flush()).toBeNull();
  });

  it("treats a whitespace-only tail as nothing", () => {
    const splitter = new LineSplitter();
    expect(splitter.push("SAY a [x]\n   ")).toEqual(["SAY a [x]"]);
    expect(splitter.flush()).toBeNull();
  });
});
