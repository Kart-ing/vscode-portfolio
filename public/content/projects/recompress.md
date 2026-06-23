# ReCompress

> Query-aware prompt compression that makes long contexts fit in small models.

**Role:** Solo / Lead · **Year:** 2026 · **Status:** Published research + Live demo
**Links:** [GitHub](https://github.com/Kart-ing/ReCompress) · [Live Demo](https://demo-eight-olive-97.vercel.app) · [Slides](https://slides-teal-tau.vercel.app) · [Paper](https://doi.org/10.5281/zenodo.20786357)

> Built in 24 hours at the UC Berkeley AI Hackathon 2026 for the Token Company Compression Challenge.

## The Problem
LLM context windows are expensive and bloated with text that has nothing to do with the actual query. Small models can't hold long, multi-turn conversations, so context gets truncated or costs balloon. The waste compounds with every turn.

## What I Built
A two-act compression system:

- **Act 1 — Single-shot, query-aware compression.** Rewrites incoming context to drop passages irrelevant to the query, squeezing HotpotQA context down to **~3.5% of the original tokens** without losing the answer.
- **Act 2 — "Re:Zero" multi-turn memory.** Keeps a 12-turn conversation flat at **~184 tokens** versus a naive **~1,482**, an **8.1× reduction** that holds as the conversation grows.

To make it cheap to run, I distilled a DeepSeek teacher into a **Qwen2.5-1.5B + LoRA** student on 5,000 QA pairs. The whole thing is evaluated research-grade: bootstrap 95% confidence intervals, cross-solver audits, and mask-the-answer validation to prove the compressed context still carries the signal.

## Tech Stack
`Python` · `Modal (H100 training)` · `Qwen2.5-1.5B` · `LoRA` · `DeepSeek / OpenAI / Anthropic SDKs` · `datasets` · `tiktoken` · `Arize Phoenix` · `React + Vite`

## Highlights
- **Published** — Zenodo DOI [10.5281/zenodo.20786357](https://doi.org/10.5281/zenodo.20786357)
- **8.1×** token reduction across a 12-turn conversation
- Context compressed to **~3.5%** of HotpotQA tokens, single-shot
- Reproducible Colab + research-grade eval (bootstrap CIs, cross-solver audits, mask-the-answer)
- Live demo and slide deck shipped on Vercel

## Links
- GitHub: https://github.com/Kart-ing/ReCompress
- Live Demo: https://demo-eight-olive-97.vercel.app
- Slides: https://slides-teal-tau.vercel.app
- Paper (Zenodo): https://doi.org/10.5281/zenodo.20786357
