# PingPal

> Ambient, end-to-end-encrypted messaging for terminal-based developers — pings inside your coding agent.

**Role:** Solo / Lead · **Year:** 2026 · **Status:** Shipped — published to npm
**Links:** [GitHub](https://github.com/Kart-ing/pingpal)

```bash
npm i -g pingpal
```

## The Problem
Developers who live in the terminal and Claude Code have no lightweight way to ping each other. Every nudge means a context switch out to Slack or iMessage, breaking flow right when focus matters most.

## What I Built
A daemon + CLI + MCP server + relay, built as a TypeScript/Node pnpm monorepo. It surfaces tiny **end-to-end-encrypted** pings directly into Claude Code sessions via hooks and MCP, complete with live presence and ASCII faces. mDNS LAN auto-discovery connects same-network peers instantly, degrading gracefully to a self-hostable relay for remote contacts. A hard 90-character message limit forces clarity. Works across Claude Code, OpenCode (plugin), and Codex.

## Tech Stack
`TypeScript / Node.js` · `pnpm monorepo` · `WebSocket relay` · `zod` · `Unix-socket IPC` · `mDNS / Bonjour` · `Fly.io / Railway`

## Highlights
- **E2E encrypted** — the relay can't read your messages
- Meet-style ephemeral join codes for instant pairing
- Multi-client: Claude Code, OpenCode, and Codex
- mDNS LAN auto-discovery with public relay fallback (live on Railway)

## Links
- GitHub: https://github.com/Kart-ing/pingpal
- npm: `npm i -g pingpal`
