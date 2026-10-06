// The fixed UI strings an answer may show besides record and script text
// (invariant I1, set c). Today that is only the no-answer line, which the
// page shows when /api/answer ends with done:none and no sentence.

export const NO_ANSWER_TEXT = "Nothing in the record answers that.";

export const UI_ALLOWLIST: readonly string[] = [NO_ANSWER_TEXT];
