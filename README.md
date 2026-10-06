# kartikey.fyi

Kartikey Pandey's site: a cinematic 3D star map of the work. Ask a question,
and beams race to candidate stars while the site picks a short answer from the
verified record. Each sentence cites the record, and the camera cuts to every
cited star as its sentence streams in.

V1, the VS Code-themed portfolio, is archived on the `v1` branch and the
`v1.0` tag. V2 is in the history of `main`.

## How answers work

`src/content/record.ts` is the only source of facts: 27 stars and 70 short
lines. Many lines link a public source (a repo, Devpost page, DOI or organizer
write-up). The owner's canonical strings (his About, role
line and numbers) live in `src/content/canonical.ts` and are used verbatim.

Every sentence an answer shows is either a record line's own text or a
curated sentence from `scripts.ts` or `chips.ts` that cites the record. The
only other text is the no-answer line. No model ever writes a sentence.

`POST /api/answer` streams NDJSON events (`beams`, `view`, `say`, `done`):

1. Private, off-topic and prompt-injection questions end at once with nothing.
2. Preset chips, greetings and hire, back or invest questions play curated,
   cited sentences ("What has Kartikey built?"). None of these call a model,
   and none of them opens with a verdict.
3. For any other question, the local keyword router first picks the candidate
   lines, at most 12, with no model involved
   (`src/lib/server/answer/gate.ts`). No candidates means no answer. A
   capitalized name the record never mentions, such as NASA, gets none too.
4. When a key is set, a free model on OpenRouter (GLM-5.2, then Nemotron 3.5
   Lightning, then Nex N2.5 Pro) sees only those candidates and replies with
   ids. The server drops every id outside the set and shows the remaining
   lines word for word. It refuses any model id that doesn't end in `:free`.
5. If the model is off, busy, slow, over budget or returns nothing usable, the
   router's own answer from the same candidates is shown. The API never
   returns a 500.

`src/lib/server/__tests__/invariant.test.ts` pins the candidate sets for a set
of probe questions and runs hostile model replies against them.
`src/content/__tests__/privacy.local.json` holds the owner's private terms; it
is git-ignored, and the privacy tests fail without it.

## Also on the page

- **Intro:** a warp-in where stars light up in the order the work happened.
- **3D forms:** each kind of work has its own shape, such as a monolith,
  crystals, gold shards, ringed planets or stations.
- **Controls:** a timeline scrubber and a 60-second guided tour.
- **Cards:** images, stack badges and live GitHub activity from `/api/pulse`.
- **Sound:** synthesized with WebAudio and off by default.

## For agents

- `/llms.txt`: the record as markdown
- `/record.json`: the record as JSON
- `/record`: the whole record as a plain, JS-free page

## Stack

Next.js 16 (App Router), React 19, three.js with @react-three/fiber, drei and
postprocessing, motion, Tailwind 4, zod, vitest. It deploys on Vercel from
`main`.

## Develop

```sh
npm install
npm run dev          # http://localhost:3000
npx vitest run       # record, scripts, gate and invariant, router, budgets, routes
npm run lint && npm run build
```

Environment variables (all optional):

| Name | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Lets a free model pick among the router's candidate lines. Without it, the router answers. |
| `OPENROUTER_MODELS` | Comma-separated override of the free model chain. Non-free ids are ignored. |
| `GITHUB_TOKEN` | Raises GitHub rate limits for `/api/pulse`. |

Plans: [docs/PRD.md](docs/PRD.md) (V2), [docs/PRD-v3.md](docs/PRD-v3.md) (V3).
