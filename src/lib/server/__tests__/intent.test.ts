import { describe, expect, it } from "vitest";
import { isAdvocateQuestion, isVagueQuestion } from "@/lib/server/answer/intent";
import { normalizeQuestion } from "@/lib/server/flight/text";

const advocate = (q: string) => isAdvocateQuestion(normalizeQuestion(q));
const vague = (q: string) => isVagueQuestion(normalizeQuestion(q));

describe("isAdvocateQuestion", () => {
  it("matches hire, back, fund, invest, partner and work-with phrasings", () => {
    for (const q of [
      "should we hire him?",
      "Should we hire Kartikey?",
      "Should I hire him",
      "is he worth hiring",
      "is Kartikey worth it?",
      "should I invest in Karts",
      "would you invest in karts",
      "is karts a good investment",
      "why should we back Kartikey",
      "worth backing?",
      "would you fund karts",
      "should my company partner with karts",
      "would you recommend working with him",
      "is it worth working with kartikey",
      "why work with him",
      "should we bring him on",
      "should we recruit kartikey",
      "is he a good hire",
      "can we trust him",
      "should i bet on kartikey",
      "reasons to hire kartikey",
      "make the case for hiring him",
      "should we interview him",
      "why Kartikey?",
      "why him",
      "why kartikey over other candidates",
      "should we go with karts",
      "would you recommend him",
    ]) {
      expect(advocate(q), q).toBe(true);
    }
  });

  it("does not match history, work and topic questions", () => {
    for (const q of [
      "who hired Kartikey before",
      "how many people has he hired",
      "where did he work",
      "what did he work on at intel",
      "work history",
      "who did he work with at intel",
      "did he work with python",
      "what funding did he get",
      "what is the snap accelerator funding",
      "what did he build back in 2020",
      "background",
      "who was his hackathon partner",
      "who invested in karts",
      "who backed karts",
      "what did he invest his time in?",
      "why did kartikey build karts",
      "why kartikey left intel",
      "what is karts",
      "is karts open source",
      "hackathon wins",
      "what should I know",
      "what should I know about kartikey",
      "tell me about the patent",
      "",
    ]) {
      expect(advocate(q), q).toBe(false);
    }
  });
});

describe("isVagueQuestion", () => {
  it("matches greetings and open questions", () => {
    for (const q of [
      "hi",
      "Hi!",
      "hello",
      "hey there",
      "yo",
      "who is Kartikey",
      "who is kartikey pandey",
      "who are you",
      "who is this",
      "tell me about him",
      "tell me something impressive",
      "tell me something",
      "surprise me",
      "impress me",
      "what should I know",
      "what should i know about kartikey",
      "what does kartikey do",
      "what has he built",
      "what is he known for",
      "summarize everything",
      "give me the highlights",
      "highlights",
      "help",
      "what can I ask",
    ]) {
      expect(vague(q), q).toBe(true);
    }
  });

  it("does not match questions with a topic", () => {
    for (const q of [
      "what is karts",
      "hackathon wins",
      "where did he work",
      "what has kartikey built with python",
      "does he know rust",
      "tell me about the patent",
      "what research has he published",
      "who is kartikey working with",
      "tell me something about karts pricing",
      "what is his best work",
      "what llm work has he done",
      "should we hire him",
      "",
    ]) {
      expect(vague(q), q).toBe(false);
    }
  });
});
