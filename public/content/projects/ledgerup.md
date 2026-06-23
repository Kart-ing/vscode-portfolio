# LedgerUp

> An AI agent that logs into SaaS portals and files invoices — including email-OTP 2FA.

**Role:** Solo / Lead · **Year:** 2026 · **Status:** WIP (demo flow working)
**Links:** _Private — no public repo yet._

## The Problem
Submitting invoices into supplier portals like Coupa is manual, repetitive, and gated by 2FA. It's exactly the kind of work that's too fiddly to outsource cheaply and too boring to do yourself.

## What I Built
A browser-automation agent (**Stagehand + Browserbase**) that logs into portals, **solves email-OTP 2FA via the Gmail MCP**, and uploads invoice PDFs. The core is portal-agnostic — a queue, an audit trail, and a dashboard — with pluggable adapters per portal, plus a 1Password-TOTP path for Coupa. Every action lands in an append-only event log with a screenshot for each step. A state machine drives each job: `to_submit → submitting → (done | needs_attention | failed)`.

## Tech Stack
`Node.js` · `Stagehand` · `Browserbase` · `Gmail MCP` · `Express` · `SQLite (better-sqlite3)` · `1Password CLI` · `Vercel (demo portal)`

## Highlights
- Automated **email-OTP 2FA** via the Gmail MCP
- Pluggable portal adapters on a portal-agnostic core
- Full audit trail with per-step screenshots
- 21 unit tests on the OTP provider

## Links
- _No public repo yet — currently private._
