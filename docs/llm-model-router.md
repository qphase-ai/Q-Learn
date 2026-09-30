# LLM Model Router

**Files:** `backend/app/agents/router.py` · `backend/app/agents/llm.py` · `backend/app/config.py`

---

## Why it exists

Free-tier LLM providers cap every model on several dimensions at once, and the first limit reached returns a 429. The naive approach — always try the primary model, fall back only after a 429 — spends requests hitting those limits before recovering.

The router inverts this: **before** picking a model, it checks which one has the most remaining capacity for *this* request and routes there. The `.with_fallbacks()` chain stays in place as a safety net, but under normal load it is rarely triggered.

---

## How Groq rate-limits (verified against live responses)

| Fact | Source |
|------|--------|
| Limits apply per **organization**, not per API key — extra keys in one org share one quota | [Groq docs](https://console.groq.com/docs/rate-limits) |
| Four dimensions: RPM, RPD, TPM, TPD — whichever is hit first triggers the 429 | Groq docs |
| `x-ratelimit-*-requests` headers always mean **per day**; `x-ratelimit-*-tokens` always mean **per minute** | Groq docs |
| Limits **refill continuously**, not at a clock boundary: after one request against a 1,000 RPD model, `x-ratelimit-reset-requests` reads `1m26.4s` (= 86,400 s ÷ 1,000) | live response headers |
| TPM holds **prompt + `max_tokens`** while a request is in flight (a 1-token `max_tokens` request left 7,927/8,000 TPM, a 512 one left 7,393) and releases the unused part when it completes, so sustained throughput depends on tokens actually used | live response headers + load test |
| TPM is a continuously refilling bucket that **starts full**: from idle a model accepts ~8,000 tokens at once plus ~8,000 more refilled over the next minute, so a 60 s test from idle passes ~2× the steady-state rate | load test + live 429 accounting |
| Docs say cached prompt tokens don't count toward limits (gpt-oss models only), but **caching was not active on our free-tier org**: responses carry no `prompt_tokens_details`, and identical repeated prompts were charged in full | Groq docs vs. live raw responses |
| No monthly limits | Groq docs |

---

## Two-layer design

```
get_llm(est_tokens)
        │
        ▼
┌──────────────────────────────────┐
│  Layer 1 — Proactive routing     │  ModelRouter ranks models by headroom
│  (refilling buckets per model)   │  for a request of est_tokens tokens,
└──────────────┬───────────────────┘  reserves capacity on ordered[0]
               │
               ▼
        LLM API call ──────────────► RouterUsageLogger (LiteLLM callback)
               │                       success: reconcile real tokens,
       ┌───────┴────────┐                       adopt x-ratelimit-remaining-*
       │ success        │ error / 429  failure: refund tokens,
       ▼                ▼                       cool down for retry-after
   Return tokens  ┌──────────────────────────────┐
                  │  Layer 2 — Reactive fallback  │  LangChain .with_fallbacks()
                  │  tries ordered[1], [2], ...   │
                  └──────────────────────────────┘
```

---

## ModelRouter internals

### Refilling buckets

Each model gets one bucket per dimension it is limited on: RPM and TPM refill over 60 s, RPD and TPD over 86,400 s. A bucket holds `capacity` units and refills at `capacity / period` per second, capped at `capacity` — the same continuous refill Groq uses. Consuming more than is available drives a bucket negative; the debt is repaid by refill.

### Ranking (`get_ordered_models(models, est_tokens)`)

Each model lands in one of three tiers:

1. **Ready** — every bucket can cover 1 request + `est_tokens`, no cooldown, and remaining daily budget (RPD/TPD) above 10%.
2. **Daily reserve** — ready, but inside the last 10% of its daily budget. These go behind every ready model, so the final slice of a daily quota is only spent when nothing else can take the request.
3. **Waiting** — some bucket is short or the model is cooling down after a 429. Sorted by seconds until ready, soonest first. Still returned, so the fallback chain always has somewhere to go.

Within tiers 1 and 2, models are sorted by **headroom**: the smallest remaining fraction across all dimensions after this request. That spreads load evenly instead of draining one model first.

### Feedback (`RouterUsageLogger` in `llm.py`)

`get_llm()` tags every `ChatLiteLLM` in the chain with metadata naming the model and the reservation. A LiteLLM callback reads it back after each attempt:

| Event | Action |
|-------|--------|
| Success on the reserved model | `adjust_tokens(actual − estimate)` |
| Success on a fallback | `record(model, actual)` — it had no reservation |
| Any success | `sync_from_headers` — Groq's remaining RPD/TPM replace the local estimate |
| Failure on the reserved model | refund the token reservation |
| `RateLimitError` | `mark_rate_limited`: cool down for `retry-after` (default 10 s), sync headers |

### Token estimates

`estimate_tokens(messages, max_tokens)` = prompt characters ÷ 4 + `max_tokens`. That matches how Groq charges TPM at request start; header sync corrects any drift.

### Thread safety

A single `threading.Lock` guards all bucket state. Operations are microsecond-scale in-memory arithmetic.

---

## Capacity (default free-tier pool)

| Model | RPM | RPD | TPM | TPD |
|-------|-----|-----|-----|-----|
| `groq/openai/gpt-oss-120b` (primary) | 30 | 1,000 | 8,000 | 200,000 |
| `groq/openai/gpt-oss-20b` | 30 | 1,000 | 8,000 | 200,000 |
| `groq/qwen/qwen3.8-27b` | 30 | 1,000 | 8,000 | 200,000 |

**TPM is the binding limit.** Steady-state throughput ≈ 24,000 ÷ tokens per request (prompt + output), capped at 90 RPM (3 × 30) and **3,000 requests/day** in total. Bursts from idle get up to ~2× that for about a minute.

### Measured (Docker, live Groq, 2026-09-30)

Open-loop load against `get_llm()` inside the `api` container. Each request: ~1,500-token tutor-style context + a 2–3 sentence question; actual usage averaged **~1,800 tokens/request** (including gpt-oss reasoning tokens).

| Offered load | Succeeded | Latency p50 / p95 | Distribution (120b / 20b / qwen) |
|--------------|-----------|-------------------|----------------------------------|
| 20 RPM × 60 s | **20/20** — no 429s | 0.77 s / 1.64 s | 6 / 7 / 7 |
| 40 RPM × 60 s | **18/40** — 22 failed with `RateLimitError` after all three models 429'd | 0.95 s / 1.52 s | 7 / 6 / 5 |

The 20 RPM stage started from full buckets, so it overstates the steady state: at ~1,800 tokens/request the sustainable rate is **~13 RPM** (24,000 ÷ 1,800). Above the ceiling, requests fail rather than queue — the router has no admission queue, so once all three models are exhausted every attempt 429s.

### Tutor prompt size

Tutor prompts carry 5 retrieved sources (chunked at up to 800 words each) plus up to 20 earlier messages in full. Measured worst-case prompt tokens: **~5,300** on turn 1, **~8,400** by turn 6, **~11,600** by turn 11. That is ~2–4 tutor RPM across the pool, and a prompt above 8,000 tokens exceeds a single model's free-tier TPM, so long sessions with large sources can fail on every model.

A burst of 12 concurrent short requests (~200 tokens each) all succeeded, with one 429 absorbed by fallback.

Sustained 250–300 RPM is not reachable on the free tier — it needs a paid Groq tier. Once upgraded, put the numbers from `console.groq.com/settings/limits` into `LLM_MODEL_LIMITS`; no code changes are needed.

> **Model churn:** Groq retires models. Check `GET https://api.groq.com/openai/v1/models` when updating the pool — the previous Llama/Mixtral pool had been fully retired, which made every Groq call fail through to the non-Groq fallbacks.

The pool is Groq-only, so once all three models are saturated there is no overflow provider: requests go to the soonest-ready Groq model and may get a 429. Adding any other provider's model (e.g. `gemini/…`, with its API key set) to `LLM_FALLBACK_MODELS` restores overflow — the router ranks it after Groq.

---

## Shared conversation context

Every `get_llm()` call may be served by a different model. `tutor_service.run_and_stream()` loads the prior `AgentMessage` rows for the session and passes them to `stream_tutor_answer()` on every call, so any model in the pool sees the full conversation. History is capped at **20 rows (10 turns)**; every Groq model in the pool has a 131k-token context window.

---

## Configuration

| Env var | Type | Default | Description |
|---------|------|---------|-------------|
| `LLM_PRIMARY_MODEL` | `str` | `groq/openai/gpt-oss-120b` | First model in the pool (the router may still pick another) |
| `LLM_FALLBACK_MODELS` | JSON list | `groq/openai/gpt-oss-20b`, `groq/qwen/qwen3.8-27b` | Rest of the pool |
| `LLM_TEMPERATURE` | `float` | `0.7` | Sampling temperature |
| `LLM_MAX_TOKENS` | `int` | `2048` | Max output tokens — held against TPM while a request is in flight, so it limits burst concurrency |
| `LLM_MODEL_LIMITS` | JSON dict | `{}` | Per-model overrides of any of `rpm`, `rpd`, `tpm`, `tpd`; omitted fields keep built-in values |

```bash
# Paid Groq tier
LLM_MODEL_LIMITS={"groq/openai/gpt-oss-120b": {"rpm": 1000, "rpd": 500000, "tpm": 250000}}
```

Built-in limits live in `_MODEL_LIMITS` (exact models) and `_PREFIX_LIMITS` (per provider) in `router.py`.

### Provider prefixes and API keys

| Provider | Model prefix | Key env var |
|----------|-------------|-------------|
| Groq | `groq/` | `GROQ_API_KEY` |
| Google | `gemini/` | `GEMINI_API_KEY` |
| OpenRouter | `openrouter/` | `OPENROUTER_API_KEY` |
| Anthropic | `anthropic/` | `ANTHROPIC_API_KEY` |
| OpenAI | _(none)_ e.g. `gpt-4o-mini` | `OPENAI_API_KEY` |
| Ollama | `ollama/` | _(none — local)_ |

---

## Scaling to multiple replicas

Bucket state is in-process, so each API replica sees only its own traffic and the pool can over-send by a factor of the replica count. Header sync partly compensates — every Groq response carries the organization-wide remaining RPD and TPM — but a shared store is needed for accurate RPM/TPD. The state is behind `record`, `adjust_tokens`, `sync_from_headers` and `mark_rate_limited`; a Redis-backed implementation of those methods (e.g. one hash per model with `level` and `updated` fields, updated in a Lua script) leaves `get_llm()` and callers unchanged.

---

## Tests

`backend/tests/test_model_router.py` covers limit resolution and overrides, headroom ordering, TPM exhaustion, continuous refill (including the 86.4 s RPD refill), the daily reserve tier, 429 cooldown, header sync (bare and `llm_provider-` prefixed), token refunds, thread safety, `get_llm()` reservations, and the success/failure callbacks.

Run: `cd backend && pytest tests/test_model_router.py -v`
