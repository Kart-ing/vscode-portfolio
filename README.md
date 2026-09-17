# kartikey.fyi

Kartikey Pandey's site: a 3D star map of the work. Ask a question and the
camera flies to the stars that answer it. Every line on screen comes from a
verified record and links to its evidence.

V1, the VS Code-themed portfolio, is archived on the `v1` branch and the
`v1.0` tag.

## How answers work

1. `src/content/record.ts` is the only text visitors ever see: 29 stars and 81
   short lines, each backed by a repo, Devpost page, DOI, patent record or
   organizer write-up.
2. `POST /api/flight` turns a question into a flight plan of 1-4 line ids.
   - Preset questions and repeat questions answer from a fixed plan or a
     cache, with no model call.
   - Otherwise GLM-5.2 (free, via OpenRouter) picks ids from the record. It
     cannot write prose. The server keeps only ids that exist.
   - If the model is slow, rate-limited, over budget or unconfigured, a local
     keyword router picks the ids instead. The API never returns a 500.
3. The client flies the camera to each star and opens its card.

Private or off-topic questions return nothing. So does prompt injection: the
worst it can do is pick the wrong stars.

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
npx vitest run       # record, router, budgets and route tests
npm run lint && npm run build
```

Environment variable (optional):

| Name | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Enables the model router. Without it, the local router answers. |

The plan behind V2 is in [docs/PRD.md](docs/PRD.md).
