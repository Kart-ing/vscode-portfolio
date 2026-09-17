# kartikey.fyi V3: the AI flies the ship

## Outcome

V3 makes the AI visible and the scene cinematic. A visitor asks a question, and
beams of light race to candidate stars while the AI thinks. The AI then
narrates a short answer. Each sentence cites the record, and the camera cuts to
each cited star as its sentence streams in. The AI can also stage a 3D view: a
timeline, a comparison, a stack map or a constellation. The site plays a
cinematic intro, gives every kind of work its own 3D form, adds a timeline
scrubber, richer cards, a guided tour, live GitHub pulses and optional ambient
sound.

"Should we hire Kartikey?", and any hire, back, invest or work-with question,
always answers "Yes." followed by cited proof. That answer is scripted, so it
never depends on the model.

V2 stays on `main` until V3 passes its acceptance checks.

## Owner decisions

- **Model:** GLM-5.2 free via OpenRouter (`z-ai/glm-5.2:free`). The limits are
  50 requests a day, 20 a minute, a 32K context, and no tools or JSON. The key
  goes in `OPENROUTER_API_KEY`.
- **Answers:** narrated flight plus generated views.
- **3D:** cinematic intro, thinking beams, one 3D object per kind, timeline
  scrubber.
- **Depth:** richer cards, guided tour, live proof-of-work, ambient sound.
- **Advocacy:** hire/back/invest questions answer "Yes." with proof.

## Truth rules (unchanged, stricter)

1. Every visible fact comes from `src/content/record.ts`.
2. Every model sentence must cite at least one facet id, and every citation
   must exist. A sentence that fails either check is dropped before it
   reaches the client.
3. Every number in a model sentence must appear in the text of one of its
   cited facets, or the sentence is dropped. This covers figures like 12x,
   $1,000, 97% and 2026.
4. Narration names Kartikey and never uses pronouns for Kartikey.
5. Private and off-topic questions return mode "none". Vague questions
   ("hi", "tell me something impressive") return the scripted highlights,
   never "none".
6. No hidden text aimed at AI reviewers.

## Answer pipeline: POST /api/answer

The request is `{question}`. The response is NDJSON: one `AnswerEvent` per
line, and the stream always ends with `done`.

1. Validate as in V2: trim, 1-200 characters. Anything invalid emits
   `done:none`.
2. Deny list (private, off-topic, injection): emit `done:none`.
3. Advocate intent (hire, recruit, back, fund, invest, partner, work with,
   worth it): stream the scripted `advocate` answer, then `done:advocate`.
4. Chip question: stream the chip's sentences and view, then `done:chip`.
5. Cache hit: replay the stored events, then `done:cache`.
6. Emit `beams` right away: the local router's top 3-6 candidate star ids.
7. If a budget allows (6 per client per 10 minutes, 45 per UTC day) and a key
   exists, stream from OpenRouter:
   - Settings: `stream: true`, reasoning off, temperature 0.2, max_tokens
     about 600, a 12-second overall timeout.
   - Output protocol, plain text lines:
     ```
     VIEW <timeline|compare|stack|constellation> <ids...>   (optional, first line)
     SAY <one sentence, at most 30 words> [facet.id] [facet.id]
     END
     ```
   - Allow 2-4 SAY lines. The prompt carries the rules plus the index
     `facet_id | star label | facet text`, and treats the question as data.
   - Parse the stream line by line. Validate every VIEW and SAY line (truth
     rules 2-3) and emit a `view` or `say` event as soon as a line is valid.
     Strip citation markers from the displayed text.
   - If at least one sentence survives, end with `done:model`.
8. Otherwise, or on any failure (429, timeout, zero valid sentences): produce
   a local narrated answer. The local router picks 1-4 facets, and each
   sentence is that facet's text with its citation. End with `done:local`.
   Vague questions get the highlights instead.
9. Never return a 500. Log without the question.

`/api/flight` keeps working for V2 compatibility; the V3 UI does not use it.

## GET /api/pulse

Returns `RepoPulse[]` for stars that have a `repo`, using two GitHub calls
per refresh: `/users/Kart-ing/repos` and
`/users/Kart-ing/events/public`. Cache it for 15 minutes. It uses
`GITHUB_TOKEN` if set, and returns `[]` on any failure.

## Experience

- **Intro (first visit per session, skippable):** a warp-in through
  streaking stars. Stars ignite in `start` order from 2020 to 2026 while a year
  counter ticks, the constellation lines draw themselves, and a title card
  shows. About 6 seconds. It ends by calling `finishIntro()`.
- **Thinking beams:** while status is "asking", thin light beams race from
  the camera toward `beams` stars. When sentences arrive, the beams to cited
  stars lock and brighten, and the others fade.
- **Narration:** sentences appear one at a time. Each citation is a chip.
  When a sentence lands, the camera cuts to its first cited star, and
  clicking a chip flies there. Cards show the cited facet highlighted.
- **Generated views:** the scene rearranges stars into the staged view,
  with 3D panels or labels:
  - timeline: along a glowing time axis, by `start`
  - compare: 2-3 stars side by side with facts
  - stack: technology nodes linked to the stars that use them
  - constellation: one constellation up close
  Esc returns to the free map.
- **3D objects per kind:** company is a slowly turning monolith; paper and
  patent are faceted crystals; award is gold shards; role is a ringed planet;
  project is an orbiting station; community is a particle ring; education is
  a lit dome or arch. All procedural geometry, no model files. Glow stays
  consistent with V2.
- **Timeline scrubber:** a range slider from 2020 to 2026. Stars outside the
  range dim and shrink, with animation. The overview can auto-play the years.
- **Richer cards:** media (owner's project images under /public/media), stack
  badges, live GitHub stats (stars, last push) from pulses, and demo and
  evidence links.
- **Guided tour:** a "Take the tour" button. About 60 seconds of autoplay
  through the curated tour steps, narrated. Play, pause, next and exit.
- **Live proof-of-work:** stars whose repos were pushed in the last 30 days
  pulse; the most recent pulse is brightest.
- **Ambient sound:** off by default, with a toggle. It's WebAudio-synthesized:
  a soft pad, plus a whoosh on flights and a chime on citation lock. No audio
  files.
- **Fallbacks:** reduced motion means no intro or beams, fades instead of
  flights, and sound stays off. Without WebGL, the V2 static starfield plus
  narration still works. /record, /record.json and /llms.txt stay.

## Work split

Agents share one tree (`~/Documents/kartikey.fyi`, branch `v3`). Each touches
only its own files, never commits, never edits `package.json` or
`src/lib/contract.ts`, and never runs `next build`. For a dev server, each uses
`NEXT_DIST_DIR=.next-<agent> npx next dev --port <port>` and kills only its own
PIDs.

| Agent | Owns | Port |
|---|---|---|
| Content | `src/content/**` (record meta, chips, `scripts.ts`), `public/media/**`, `src/content/__tests__/**` | none |
| Answer API | `src/app/api/**`, `src/lib/server/**`, `vitest.config.ts` | 3201 |
| Scene | `src/components/scene/**`, `src/app/dev/**` | 3202 |
| UI | `src/app/page.tsx`, `layout.tsx`, `globals.css`, `src/app/record/**`, `src/components/ui/**`, `src/lib/flight-state.tsx` | 3203 |

Shared signals live in `useFlight()` and are already typed in
`flight-state.tsx`: `narration`, `beams`, `view`, `answerMode`,
`yearRange`, `tour`, `pulses`, `intro`, `setYearRange`, `startTour`,
`stopTour` and `finishIntro`. The UI agent implements them. The scene agent
reads them and calls `finishIntro()` and `focusStar()`.

## Acceptance

- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and `npm run build` all
  pass.
- "Should we hire Kartikey?" shows "Yes." plus at least 3 cited proof
  sentences, with zero model calls and no API key.
- With no key, typed questions still narrate through the local router.
  "hi" and "tell me something impressive" show the highlights.
- Truth rules are covered by tests: an uncited sentence, an unknown id and
  an unsupported number are each dropped.
- The intro, beams, views, per-kind objects, scrubber, tour, pulses and sound
  all work at 1440x900 and 390x844, with no console errors, no horizontal
  scroll and reduced motion honored.
- Production home-page first-load JS stays reasonable. Scene code is
  lazy-loaded, and the intro never blocks HTML content.

## Owner actions

- Add `OPENROUTER_API_KEY` in Vercel (Production). Allow free-model data use in
  OpenRouter's privacy settings if requests fail with a data-policy error.
- Optional: add `GITHUB_TOKEN` (read-only public) to raise GitHub rate limits.
