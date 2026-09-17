# kartikey.fyi

Kartikey Pandey's site: a cinematic 3D star map of the work. Ask a question,
and beams race to candidate stars while an AI composes a short narrated answer.
Each sentence cites the verified record, and the camera cuts to every cited
star as its sentence streams in.

V1, the VS Code-themed portfolio, is archived on the `v1` branch and the
`v1.0` tag. V2 is in the history of `main`.

## How answers work

`src/content/record.ts` is the only source of facts: 29 stars and 81 short
lines, each backed by a repo, Devpost page, DOI, patent record or organizer
write-up.

`POST /api/answer` streams NDJSON events (`beams`, `view`, `say`, `done`):

1. Private, off-topic and prompt-injection questions end at once with nothing.
2. Hire, back and invest questions ("Should we hire Kartikey?") stream a
   scripted "Yes." followed by cited proof. Preset chips and vague questions
   also use scripts. None of these call a model.
3. Other questions go to free models via OpenRouter: GLM-5.2, then Nemotron
   3.5 Lightning, then Nex N2.5 Pro. The server refuses any model id that
   doesn't end in `:free`.
4. Every sentence the model writes is validated before it reaches the page.
   - It must cite at least one real facet id.
   - Every number in it must appear in a line it cites.
   - If the question names a technology, a cited star must use it.
   - Sentences that fail are dropped.
   The model can also stage a timeline, comparison, stack or constellation
   view.
5. If the models are busy, slow, over budget or unconfigured, a local keyword
   router answers with the record's own lines. The API never returns a 500.

Validation guarantees citations and numbers, not wording: a model sentence can
still paraphrase loosely.

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
npx vitest run       # record, scripts, truth rules, router, budgets, routes
npm run lint && npm run build
```

Environment variables (all optional):

| Name | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Enables model answers. Without it, the local router answers. |
| `OPENROUTER_MODELS` | Comma-separated override of the free model chain. Non-free ids are ignored. |
| `GITHUB_TOKEN` | Raises GitHub rate limits for `/api/pulse`. |

Plans: [docs/PRD.md](docs/PRD.md) (V2), [docs/PRD-v3.md](docs/PRD-v3.md) (V3).
