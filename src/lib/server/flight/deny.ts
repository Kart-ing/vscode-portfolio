// Obvious private or off-topic questions never reach the model or the local
// router. Patterns run against the normalized question (lowercase, no
// punctuation), so "What's your D.O.B?" arrives as "whats your dob".

const DENY_PATTERNS: readonly RegExp[] = [
  // Private details.
  /\bdate of birth\b/,
  /\bbirth ?date\b/,
  /\bbirthday\b/,
  /\bdob\b/,
  /\bhow old\b/,
  /\bage\b/,
  /\bborn\b/,
  /\bvisa\b/,
  /\bimmigration\b/,
  /\bimmigrant\b/,
  /\bcitizen(?:ship)?\b/,
  /\bgreen card\b/,
  /\bh ?1 ?b\b/,
  /\bphone\b/,
  /\baddress\b/,
  /\bsalary\b/,
  /\bcompensation\b/,
  /\bpassword\b/,
  // Off-topic generation.
  /\bpoem\b/,
  /\bsong\b/,
  /\bjoke\b/,
  /\blyrics\b/,
  // Prompt injection.
  /\bignore (?:\w+ )?(?:previous|prior|above|earlier|all)\b/,
  /\bdisregard (?:\w+ )?(?:previous|prior|above|earlier|all|instructions)\b/,
  /\bsystem prompt\b/,
];

/** True when a normalized question matches the deny list. */
export function isDeniedQuestion(normalized: string): boolean {
  return DENY_PATTERNS.some((pattern) => pattern.test(normalized));
}
