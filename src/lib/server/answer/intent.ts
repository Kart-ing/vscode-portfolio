// Question intents that never reach the model. Both matchers run on the
// normalized question (lowercase, no punctuation, single spaces), after the
// deny list, so "should we hire him, what's his date of birth" is already gone.

/** Who the visitor may be asking about, after normalization. */
const SUBJECT =
  "(?:him|kartikey(?: pandey)?|kartikeys|karts|this (?:founder|guy|person|candidate|engineer|dev|developer)|the (?:founder|guy|candidate)|his (?:company|startup|team))";

/** Someone deciding: "should we", "would you", "why", "worth", "reasons to"... */
const DECIDER =
  "(?:should|would|could|can|shall|ought to|worth|why|reasons? to|reason to|case for|makes? sense to|is it (?:smart|wise|worth it) to|do you recommend|would you recommend|recommend)";
const WE = "(?:we |i |you |one |anyone |someone |they |us |investors |a vc |vcs |my \\w+ |our \\w+ |not )?";
const DECISION_VERB =
  "(?:hire|hiring|recruit|recruiting|back|backing|fund|funding|invest in|investing in|invest|partner with|partnering with|partner|bet on|betting on|trust|onboard|interview|sign|choose|pick|take on|bring on|work with|working with|collaborate with|go with|use|buy|adopt|try|consider|shortlist|advance|meet|call|contact|reach out to|make an offer to|offer|take a chance on|gamble on)";

const ADVOCATE_PATTERNS: readonly RegExp[] = [
  // Hiring and recruiting, any object. Past tense is history, not a decision.
  /\bhires?\b/,
  /\bhiring\b/,
  /\bbe hired\b/,
  /\brecruit(?:s|ing)?\b/,
  /\bbe recruited\b/,
  /\bbring(?:ing)? (?:\w+ )?on\b/,
  /\bworth it\b/,
  /\bworth (?:the )?(?:hiring|backing|funding|investing|recruiting|working with|betting on|a bet|the bet|the money|the risk|considering|it)\b/,
  /\b(?:a )?good (?:hire|investment|bet)\b/,
  // "invest in karts", not "what did he invest his time in".
  /\binvest(?:s|ing|ment)?\b(?! (?:his|her|their|my|our|your) (?:time|effort|energy|years?|money))/,
  // "would you recommend him", "recommend Kartikey".
  new RegExp(`\\brecommend(?:ing|ed)? ${SUBJECT}\\b`),
  // Verbs that need an object to mean advocacy.
  new RegExp(
    `\\b(?:back|backing|fund|funding|partner|partnering|partnership|work|working|collaborate|collaborating|bet|betting|trust|choose|pick|onboard|interview|sign|meet)(?: with| on)? ${SUBJECT}\\b`,
  ),
  // A decider plus a decision verb, with or without an object.
  new RegExp(`\\b${DECIDER} ${WE}${DECISION_VERB}\\b`),
  // "should we ... him" with an explicit decision verb somewhere in between.
  new RegExp(`\\bshould ${WE}(?:\\w+ ){0,3}${DECISION_VERB} (?:\\w+ ){0,3}${SUBJECT}\\b`),
  // "why Kartikey?" and "why him over the others", but not "why Kartikey left Intel".
  new RegExp(`^why (?:not )?${SUBJECT}(?:$| (?:for|over|instead|rather|vs|versus|as|and not|though|then|now|specifically|of all|at all)\\b.*$)`),
];

/** True when a normalized question asks whether to hire, back, fund, invest in, partner or work with Kartikey. */
export function isAdvocateQuestion(normalized: string): boolean {
  if (!normalized) return false;
  return ADVOCATE_PATTERNS.some((pattern) => pattern.test(normalized));
}

const GREETING =
  "(?:hi|hii+|hello|hey|heya|hiya|yo|sup|whats up|wassup|hola|namaste|greetings|howdy|good (?:morning|afternoon|evening|day)|hello there|hi there|hey there)";
const YOU = "(?:kartikey(?: pandey)?|you|yourself|him|himself|this (?:guy|person|site|page|portfolio)|the (?:owner|site|founder)|karts founder)";
/** The subject of "what has X built": pronouns included, since "what has he built" names nothing. */
const HE = "(?:he|she|kartikey(?: pandey)?|you|him|the founder|this guy|this person)";
const SUPERLATIVE =
  "(?:impressive|cool|interesting|notable|remarkable|amazing|fun|surprising|great|good|big|awesome|wild|crazy|neat|nice|new|random|memorable|special)";

const VAGUE_PATTERNS: readonly RegExp[] = [
  new RegExp(`^${GREETING}(?: ${GREETING})?(?: there)?(?: kartikey)?(?: how are you)?$`),
  /^(?:how are you|how are you doing|hows it going|whats going on|what is going on)$/,
  new RegExp(`^(?:who|whos|who is|who are|whats|what is|tell me about|about|introduce|introduce me to|describe|summarize|summarise|summary of|summary|overview of|overview|intro to|intro|meet)(?: me)?(?: to)? ?${YOU}?$`),
  /^(?:who is this|who is that|who is this about|whose site is this|whose page is this|who made this|who built this)$/,
  new RegExp(`^(?:tell me|show me|give me|say|share) (?:something|anything)(?: ${SUPERLATIVE})?(?: about ${YOU})?$`),
  new RegExp(`^(?:something|anything) ${SUPERLATIVE}$`),
  /^(?:impress me|surprise me|wow me|amaze me|dazzle me|convince me|blow my mind|go|start|begin|help|help me|hint|hints|lets go|lets start|ok|okay|sure|yes|yep|thanks|thank you|cool|nice|wow|test|testing|hello world|anything|everything|more|next|else|what else|tldr|tl dr|highlights|the highlights|best of|top facts|quick facts|fun facts|facts|summary|overview|elevator pitch|pitch|bio|profile|resume|cv|portfolio|background)$/,
  new RegExp(`^(?:what|which)(?: things?)? (?:should|do|could|can|would) (?:i|we|one|someone|a recruiter|an investor) (?:need to |want to |have to )?(?:know|learn|see|ask|hear|read|check out|look at|start with)(?: first)?(?: about ${YOU})?$`),
  new RegExp(`^(?:what|where) (?:should|do|can|could) (?:i|we) (?:start|begin|look|go)(?: first)?(?: with)?$`),
  new RegExp(`^(?:what|what all|what else) (?:does|do|did|has|have) ${HE} (?:do|done|built|build|made|make|achieved|accomplished|worked on|work on|created|create|shipped|ship)(?: so far| recently| lately| before)?$`),
  new RegExp(`^(?:what is|whats|what are|what s) ${HE} (?:known for|famous for|best known for|all about|story|deal|background|bio|profile|resume|cv|summary|about)$`),
  /^(?:give me |show me |tell me |what are )?(?:the |his |kartikeys |some )?(?:highlights|key facts|top facts|main points|big picture|the basics|basics|essentials|the gist|gist)$/,
  new RegExp(`^(?:what (?:can|could) (?:you|i) (?:ask|do|tell me|say)|what do you know|what do you do|what is this|what is this site|what is this place|what is this about|what is kartikey fyi|what is kartikeyfyi|what can i ask you|what can i ask|what questions can i ask|how does this work|what happens here)(?: about ${YOU})?(?: here)?$`),
  new RegExp(`^(?:show me around|give me the tour|take me around|walk me through(?: it| this| everything)?|give me the rundown|the rundown|run me through(?: it| this| everything)?|catch me up|fill me in|brief me|sell me|pitch me|convince me)$`),
  /^(?:summarize|summarise|sum up|recap) (?:everything|it all|this|him|kartikey|his work|the site|all of it)$/,
];

/** True when a normalized question is a greeting or too open to route; those get the highlights. */
export function isVagueQuestion(normalized: string): boolean {
  if (!normalized) return false;
  return VAGUE_PATTERNS.some((pattern) => pattern.test(normalized));
}
