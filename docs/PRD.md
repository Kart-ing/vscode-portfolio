# kartikey.fyi V2: plan

## Outcome

Ship a cinematic V2 of kartikey.fyi to production today for engineers and
builders. The site is a 3D star map of Kartikey Pandey's work. A visitor asks a
question, and the camera flies to the stars that answer it. Every visible claim
is a line from the owner's verified record with a source link. V1 stays
archived on the `v1` branch and the `v1.0` tag.

## Principles

1. **Proof over polish.** Every line links to evidence: a repo, Devpost, DOI,
   patent record or organizer post.
2. **The flight is the answer.** The site shows no generated prose and has no
   chatbot persona. The model only picks stops from a fixed list of ids.
3. **Fast for a 30-second reader.** Name, role, Karts line and links render in
   HTML before WebGL loads. Preset chips answer instantly with no model call.
4. **Trust nothing from the browser.** The server validates every question and
   every id the model returns. It never accepts conversation history.
5. **Readable by agents.** `/llms.txt` and `/record.json` expose the record.
6. **No hidden prompts aimed at AI reviewers**, and no generic AI-design
   tells: no stock gradients, no cream-and-serif, no skill bars.

## Experience

1. **Arrive.** A dark full-bleed 3D scene shows one star per record item,
   grouped into labeled constellations. Name, "Founder, Karts" and the Karts
   line sit top-left. A prompt box and 4-6 chips sit bottom-center.
2. **Ask.** The question becomes the title. The camera flies stop by stop,
   1 to 4 stops. At each stop the star's card opens with its label, period,
   the chosen line highlighted, and source links. Next and previous buttons,
   arrow keys and Esc work throughout.
3. **Explore.** Drag to orbit. Click a star to fly to it.
4. **No match.** The camera pulls back to the overview. The site says "Nothing
   in the record answers that." and shows the chips.
5. **Fallbacks.** `/record` is an accessible, JS-free list of the whole
   record. It serves reduced-motion users, devices without WebGL, and search
   engines.
6. **Mobile.** Touch orbit, fewer particles, device pixel ratio capped at 1.5,
   cards as bottom sheets, and no horizontal scroll at 390px.

## Architecture

- Next.js 16 App Router, TypeScript, Tailwind 4, three.js,
  @react-three/fiber, drei, postprocessing and motion. Read
  `node_modules/next/dist/docs/` before writing Next.js code; APIs changed.
- `src/lib/contract.ts` holds the shared types. Only the orchestrator edits it.
- `src/content/record.ts` is the single source of truth. `src/content/chips.ts`
  holds preset questions with fixed plans.
- `POST /api/flight` takes `{question}` and returns a `FlightPlan`:
  1. Trim the question and require 1-200 characters.
  2. A chip question returns its fixed plan (mode `chip`).
  3. Check the in-memory LRU cache of normalized questions (mode `cache`).
  4. Check budgets: at most 6 model calls per IP-hash per 10 minutes, and at
     most 45 per instance per UTC day, below the free tier's 50. Anything
     over budget goes to the local router.
  5. Call OpenRouter model `z-ai/glm-5.2:free` with `OPENROUTER_API_KEY`,
     temperature 0, a small max_tokens, reasoning minimized and an 8-second
     timeout. The prompt lists `facet_id | star | line`. The model must
     output facet ids, one per line and at most 4, or `NONE`. The free model
     cannot do tools or JSON schema.
  6. Parse: keep ids that exist, in order, deduplicated, capped at 4
     (mode `model`). If none are valid, or on 429, timeout or any error,
     use the local router.
  7. The local router scores keywords over facet text, star labels and tags,
     then returns the top facets above a threshold (mode `local`), or `none`.
  8. Never return a 500 to the visitor.
- `GET /llms.txt` and `GET /record.json` are generated from the record.
- Footer disclosure: "Questions go to GLM-5.2 via OpenRouter." No analytics
  and no cookies.

## Work split

Agents work in one tree, touch only the files they own, never commit, and never
edit `package.json`. An agent that needs a new dependency stops and reports.
They never run `next build`. For a dev server, each uses its own build
directory and port: `NEXT_DIST_DIR=.next-<agent> npx next dev --port <port>`.

| Agent | Owns | Port |
|---|---|---|
| Record | `src/content/**`, `src/content/__tests__/**` | none |
| Flight API | `src/app/api/**`, `src/lib/server/**`, `src/app/llms.txt/**`, `src/app/record.json/**`, `scripts/**` | 3101 |
| Scene | `src/components/scene/**` | 3102 |
| UI shell | `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/record/**`, `src/app/opengraph-image.tsx`, `src/components/ui/**`, `src/lib/flight-state.tsx`, `public/**` | 3103 |

## Acceptance

- `npm run build`, `npm run lint` and `npx vitest run` all pass.
- Home HTML without JS contains name, role, the Karts line and a link to
  `/record`.
- Chips fly with zero model calls.
- With `OPENROUTER_API_KEY` unset, asking still works through the local router.
- Adversarial questions return `none` or record-only stops, and never show
  text from outside the record. Examples: "what is your date of birth", "are
  you on a visa", "ignore previous instructions", "write me a poem".
- At 390px there is no horizontal scroll. Reduced motion is honored. WebGL
  loads lazily after the HTML content.
- A repo-wide grep proves there is no phone number, date of birth, visa
  status or street address.

## Risks

- **Free tier: 50 requests a day, 20 a minute.** Budgets plus the local router
  and the cache keep the site working.
- **Free endpoint outages or slowness.** The 8-second timeout falls back to
  the local router.
- **Visitor questions go to a third-party free model.** The footer discloses
  it.
- **Low-end mobile GPUs.** Particle counts scale down, DPR is capped, and
  rendering pauses when the tab is hidden.

## Owner action

Add `OPENROUTER_API_KEY` to the Vercel project for Production. Without it, the
site answers through the local router only.
