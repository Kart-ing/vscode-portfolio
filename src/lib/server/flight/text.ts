// Text normalization shared by chip matching, the cache key, the deny list and
// the local router. Everything here is pure and synchronous.

const STOPWORDS = new Set<string>([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "for", "with",
  "about", "is", "are", "was", "were", "be", "been", "being", "am", "do",
  "does", "did", "done", "have", "has", "had", "he", "she", "his", "her",
  "him", "hers", "it", "its", "they", "them", "their", "theirs", "you",
  "your", "yours", "i", "me", "my", "mine", "we", "us", "our", "what",
  "whats", "which", "who", "whos", "whom", "whose", "when", "where",
  "wheres", "why", "how", "hows", "tell", "please", "can", "could", "would",
  "should", "will", "shall", "may", "might", "must", "this", "that", "these",
  "those", "there", "here", "any", "some", "all", "get", "got", "into",
  "from", "by", "as", "if", "so", "than", "then", "up", "out", "one", "ones",
  "thing", "things", "know", "like", "much", "many", "very", "really",
  "just", "also", "ever", "made", "make", "im", "ive", "youre", "hes",
  "shes", "isnt", "dont", "didnt", "doesnt", "cant", "not", "no", "yes",
  "more", "most", "anything", "something", "everything", "ever", "s", "t",
  "kartikey", "pandey", "kartikeys", "kartikeyfyi",
]);

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeQuestion(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Light stemming: plural s, -ies, -ing, -ed. Applied to both questions and the index. */
export function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) {
    return word.slice(0, -1);
  }
  return word;
}

/** Normalize, split, drop stopwords and single characters, stem. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of normalizeQuestion(text).split(" ")) {
    if (!raw || STOPWORDS.has(raw)) continue;
    const stemmed = stem(raw);
    if (stemmed.length < 2 || STOPWORDS.has(stemmed)) continue;
    out.push(stemmed);
  }
  return out;
}
