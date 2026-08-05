# Groq API Key End-to-End Test Report

> **Security note:** Do not commit real API keys. Rotate the key immediately if it was ever exposed in chat, logs, or version control.

**Date:** 2026-08-05  
**Key status:** Works (valid).  
**Auth check:** `GET /openai/v1/models` → **HTTP 200** (~0.38s). Invalid/missing key returns **401** `invalid_api_key`.  
**Key handling:** Used only as shell env `GROQ_API_KEY`. Not written to project files or committed.  
**Key (redacted):** `gsk_…SkilQ`

---

## Full model inventory (15)

| id | owned_by | active | created | input | output |
|---|---|---|---|---|---|
| llama-3.1-8b-instant | Meta | true | 1693721698 | text | text |
| llama-3.3-70b-versatile | Meta | true | 1733447754 | text | text |
| openai/gpt-oss-120b | OpenAI | true | 1754408224 | text | text |
| canopylabs/orpheus-v1-english | Canopy Labs | true | 1766186316 | text | speech |
| groq/compound-mini | Groq | true | 1756949707 | text | text |
| whisper-large-v3 | OpenAI | true | 1693721698 | audio | transcription |
| meta-llama/llama-prompt-guard-2-22m | Meta | true | 1748632101 | text | text |
| canopylabs/orpheus-arabic-saudi | Canopy Labs | true | 1765926439 | text | speech |
| allam-2-7b | SDAIA | true | 1737672203 | text | text |
| openai/gpt-oss-safeguard-20b | OpenAI | true | 1761708789 | text | text |
| whisper-large-v3-turbo | OpenAI | true | 1728413088 | audio | transcription |
| groq/compound | Groq | true | 1756949530 | text | text |
| qwen/qwen3.6-27b | Alibaba Cloud | true | 1778288776 | text,image | text |
| meta-llama/llama-prompt-guard-2-86m | Meta | true | 1748632165 | text | text |
| openai/gpt-oss-20b | OpenAI | true | 1754407957 | text | text |

---

## Per-model chat test results

Prompt: `Reply with exactly: OK` · `max_tokens=16` · `temperature=0` · `POST /openai/v1/chat/completions`

| model | result | HTTP | latency | snippet / reason |
|---|---|---|---|---|
| llama-3.1-8b-instant | success | 200 | 0.145s | `OK` |
| llama-3.3-70b-versatile | success | 200 | 0.154s | `OK` |
| openai/gpt-oss-120b | success | 200 | 0.422s | reasoning-only reply (content empty; reasoning present) |
| canopylabs/orpheus-v1-english | skipped | — | — | TTS/speech (not chat) |
| groq/compound-mini | success | 200 | 0.598s | `OK` |
| whisper-large-v3 | skipped | — | — | Audio/transcription (not chat) |
| meta-llama/llama-prompt-guard-2-22m | success | 200 | 0.202s | `0.00136…` (guard score, not literal OK) |
| canopylabs/orpheus-arabic-saudi | skipped | — | — | TTS/speech (not chat) |
| allam-2-7b | success | 200 | 0.164s | `OK` |
| openai/gpt-oss-safeguard-20b | success | 200 | 0.167s | reasoning-only reply |
| whisper-large-v3-turbo | skipped | — | — | Audio/transcription (not chat) |
| groq/compound | success | 200 | 1.694s | `OK` (after retry; see rate limit) |
| qwen/qwen3.6-27b | success | 200 | 0.169s | started with `<think>…` (not literal OK) |
| meta-llama/llama-prompt-guard-2-86m | success | 200 | 0.183s | `0.00051…` (guard score) |
| openai/gpt-oss-20b | success | 200 | 0.403s | reasoning-only reply |

---

## Summary counts

| category | count |
|---|---|
| Working (chat HTTP 200) | **11** |
| Failed | **0** (final; after compound retry) |
| Skipped (non-chat) | **4** |
| Total models | **15** |

---

## Rate-limit / auth / transport notes

- **Auth:** Real key accepted; bad key → 401. No permanent auth failure.
- **Rate limit:** First `groq/compound` call hit **429 TPM** (message referenced `openai/gpt-oss-120b` under org, service tier `on_demand`, TPM limit 8000). Retry after ~10s succeeded.
- **Observed RPM-style headers (examples):** `llama-3.1-8b-instant` limit-requests **14400**; `llama-3.3-70b-versatile` / gpt-oss models **1000**; `groq/compound-mini` **250**. Region seen: `bom` / `dls` via Cloudflare.
- **Client note:** Python `urllib` without a normal User-Agent got Cloudflare **403 / error code 1010**; `curl` with a browser-like UA worked. Tests used curl for chat calls.

**Verdict:** Key is valid and usable for chat/completions across all listed text models; skip whisper/Orpheus for the chat endpoint.
