# Mutable

> Self-designing forms with bounded autonomy — agents adapt copy and channel, a principle lock prevents drift.

**Role:** Solo / Lead · **Year:** 2026 · **Status:** Live

## The Problem
Static forms convert poorly and can't adapt to who's filling them out. But handing the keys to a fully autonomous agent is worse — it drifts from the goal, drops required fields, and optimizes for the wrong thing.

## What I Built
A form platform where agents can rewrite copy, reorder questions, and render the same form across **web, WhatsApp, RCS, iMessage, and SMS** — while an Objective **"principle lock"** holds them to the core objective, the required slots, and the reward weights. A multi-armed-bandit experimentation engine optimizes every variation against a reward signal. The whole thing was built contract-first: a shared domain schema plus OpenAPI spec, then 4 parallel build loops against that contract.

## Tech Stack
`FastAPI (Python)` · `Next.js 15 / TypeScript` · `PostgreSQL` · `NextAuth v5` · `WhatsApp Cloud API` · `Railway` · `Vercel`

## Highlights
- Bounded-autonomy **Objective Lock** keeps adaptive agents on-goal
- Multi-channel adapters: web / WhatsApp / RCS / iMessage / SMS
- Multi-armed-bandit engine optimizes copy and ordering against a reward signal
- Live respondent **"Living View"** dashboard, deployed end-to-end
