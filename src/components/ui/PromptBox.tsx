"use client";

import type { FormEvent, RefObject } from "react";
import { MAX_QUESTION_CHARS } from "@/lib/contract";
import { useFlight } from "@/lib/flight-state";

interface PromptBoxProps {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange(value: string): void;
}

export function PromptBox({ inputRef, value, onChange }: PromptBoxProps) {
  const { ask, status } = useFlight();
  const busy = status === "asking";
  const length = value.length;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = value.trim();
    if (!question) {
      inputRef.current?.focus();
      return;
    }
    void ask(question);
    // On touch devices, close the keyboard so the card has room.
    if (window.matchMedia("(pointer: coarse)").matches) inputRef.current?.blur();
  };

  return (
    <form className="prompt" onSubmit={onSubmit} role="search" aria-label="Ask about Kartikey's work">
      <label htmlFor="ask" className="sr-only">
        Ask about Kartikey&apos;s work
      </label>
      <input
        id="ask"
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, MAX_QUESTION_CHARS))}
        maxLength={MAX_QUESTION_CHARS}
        placeholder="Ask about Kartikey's work…"
        autoComplete="off"
        autoCapitalize="sentences"
        spellCheck={false}
        enterKeyHint="send"
      />
      {length >= 150 && (
        <span className={length >= 190 ? "prompt-count is-near" : "prompt-count"} aria-live="polite">
          {length}/{MAX_QUESTION_CHARS}
        </span>
      )}
      <button
        type="submit"
        className="prompt-submit"
        data-busy={busy ? "true" : "false"}
        aria-label={busy ? "Thinking" : "Ask"}
      >
        <span className="label">{busy ? "Thinking" : "Ask"}</span>
        <span className="key" aria-hidden="true">
          ↵
        </span>
      </button>
    </form>
  );
}
