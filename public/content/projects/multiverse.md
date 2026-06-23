# Multiverse

> Speculative execution for AI agents — fork tool calls into parallel futures, commit the winner.

**Role:** Solo / Lead · **Year:** 2026 · **Status:** Hackathon (shipped in 1 day)
**Links:** [GitHub](https://github.com/Kart-ing/multiverse)

> Built at the Harness Engineering Hack on a sponsored stack: Composio, ClickHouse, Langfuse, Pioneer, and Guild.ai.

## The Problem
Agents take irreversible actions and can't easily explore alternatives or undo mistakes. One bad tool call and the run is wrecked — there's no way to try several approaches and keep only the one that worked.

## What I Built
An engine that intercepts agent tool calls and **forks them into parallel sandboxed futures** using a copy-on-write filesystem and SQLite branching. Each effect is classified as `READ`, `SPECULATABLE_WRITE`, or `IRREVERSIBLE`, so the engine knows what's safe to fork and what must be gated. Branches compete, a verifier scores them, and the highest-scoring branch is committed atomically. A full deterministic event log means you can replay any run, rewind, or fork from a past state — time-travel debugging for agents. ~3,480 LOC.

## Tech Stack
`Python 3.11` · `SQLite (copy-on-fork)` · `JSONL event log` · `Filesystem CoW` · `REST control API` · `ClickHouse streaming`

## Highlights
- Benchmark task success went from **0% → 100%** with speculation enabled
- Branch lineage IDs (`b_root.1.2`) render the entire fork tree from the IDs alone
- Deterministic replay and fork-from-past for time-travel debugging
- Effect classification (`READ` / `SPECULATABLE_WRITE` / `IRREVERSIBLE`) gates side effects safely

## Links
- GitHub: https://github.com/Kart-ing/multiverse
