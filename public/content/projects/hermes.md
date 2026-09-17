# Hermes Offloader

> Offload expensive coding-agent work to an always-on server.

**Role:** Solo / Lead · **Year:** 2026 · **Status:** Deployed (systemd services on a personal server)
**Links:** [GitHub](https://github.com/Kart-ing/hermes-offloader-setup)

## The Problem
Heavy Claude Code jobs tie up your laptop and burn premium tokens on mechanical subtasks that don't need a frontier model. The expensive reasoning and the grunt work are billed the same.

## What I Built
A job orchestrator. A `/handoff` Claude Code skill slices the current conversation into a **task DAG + context brief** and ships a bundle over SSH/scp to a daemon. The daemon watches an inbox, spins up headless `claude -p` workers, and routes mechanical subtasks to a cheaper model (DeepSeek) while keeping the critical reasoning on Claude. It returns structured status JSON plus git-diff patches, with an optional ntfy.sh phone push on completion. A read-only web dashboard shows live progress.

## Tech Stack
`Python (stdlib-only orchestrator)` · `Shell` · `systemd` · `SSH / scp` · `NDJSON` · `DeepSeek` · `ntfy.sh`

## Highlights
- Job-contract coordination via `job.json` / `tasks.json` / `BRIEF.md`
- Cheap-model delegation with critical reasoning kept on Claude
- Atomic scp delivery (staging → inbox) so jobs never arrive half-written
- Per-task audit logs and a read-only progress dashboard

## Links
- GitHub: https://github.com/Kart-ing/hermes-offloader-setup
