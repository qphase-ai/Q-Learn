# LLM Model Router

**Branch:** `feat/llm-provider-groq-openrouter` (merged)
**Files:** `backend/app/agents/router.py` · `backend/app/agents/llm.py` · `backend/app/config.py`

---

## Why it exists

The naive approach — always try the primary model, fall back to the next one only after a 429 — burns every request against the rate-limit wall before recovering. At 200 RPM sustained load with a single Groq model capped at 30 RPM, six out of every seven requests would fail and retry.

The router inverts this: **before** picking a model, it checks which one has the most remaining capacity in the current 60-second window and routes to that model. The `.with_fallbacks()` chain stays in place as a safety net for unexpected provider errors, but under normal load it is never triggered.

---

## Two-layer design

```
Request arrives at get_llm()
        │
        ▼
┌─────────────────────────────────┐
│  Layer 1 — Proactive routing    │  ModelRouter picks highest-headroom
│  (ModelRouter sliding window)   │  model before any request is sent.
└──────────────┬──────────────────┘
               │  ordered[0] = primary
               ▼
        LLM API call
               │
       ┌───────┴────────┐
       │ success        │ provider error / 429
       ▼                ▼
   Return token  ┌──────────────────────────────┐
                 │  Layer 2 — Reactive fallback  │  LangChain .with_fallbacks()
                 │  (LangChain Runnable chain)   │  tries ordered[1], [2], ...
                 └──────────────────────────────┘
```

Both layers use the same ordered model list produced by the router — the same model that ranked lowest in headroom is also last in the fallback chain.

---

## Capacity pool (default free-tier config)

Each Groq model has **its own independent** 30 RPM quota — adding a model adds 30 RPM of capacity, not shared quota.

| Model | Provider | RPM limit | Notes |
|-------|----------|-----------|-------|
| `groq/llama-3.3-70b-versatile` | Groq | 30 | Best quality; primary by default |
| `groq/llama-3.1-8b-instant` | Groq | 30 | Fastest latency |
| `groq/deepseek-r1-distill-llama-70b` | Groq | 30 | Reasoning tasks |
| `groq/gemma2-9b-it` | Groq | 30 | |
| `groq/mixtral-8x7b-32768` | Groq | 30 | Largest context (32 k) |
| `groq/llama3-70b-8192` | Groq | 30 | |
| `groq/llama3-8b-8192` | Groq | 30 | |
| `gemini/gemini-2.0-flash` | Google | 15 | Conservative; 1,500 req/day free |
| `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` | OpenRouter | 20 | 50 req/day without credits |
| `openrouter/poolside/laguna-s-2.1:free` | OpenRouter | 20 | 50 req/day without credits |
| **Total reliable capacity** | | **225 RPM** | Groq + Gemini only |
| **Total peak capacity** | | **265 RPM** | All 10 models |

> **OpenRouter warning:** Free-tier daily cap is 50 req/day without wallet credits. At full RPM that exhausts in ~2.5 minutes. Add $10 credits to raise the cap to 1,000 req/day. Include these models for quality diversity, not sustained throughput.

---

## ModelRouter internals

### Sliding-window algorithm

Each model maintains a `collections.deque` of `time.monotonic()` timestamps — one entry per request recorded in the last 60 seconds.

```
headroom = rpm_limit − len(window)
```

On every `get_ordered_models()` call:
1. For each model, pop left-side entries older than 60 seconds (`_trim`).
2. Compute `headroom` for each model.
3. Sort models by headroom descending — highest available capacity first.

On `record(model)`:
- Append the current monotonic timestamp to the model's deque.

### Why monotonic time

`time.monotonic()` cannot go backwards (no NTP jumps, no DST), which prevents false window expiry that `time.time()` could cause.

### Thread safety

A single `threading.Lock` wraps every read-modify operation inside `get_ordered_models()` and `record()`. The lock is held for microseconds (pure in-memory deque operations). Safe for FastAPI's default async + threaded worker model without contention.

### What happens when all models are saturated

The router still returns models in least-overloaded order — it never raises. The `.with_fallbacks()` chain then handles the inevitable 429s from the provider. Degradation is graceful, not a crash.

---

## `get_llm()` call flow

```
get_llm(temperature=None)
    │
    ├─ all_models = [primary] + fallbacks           from Settings
    ├─ ordered    = _router.get_ordered_models(all_models, rpm_overrides)
    ├─ _router.record(ordered[0])                  count the request now
    │
    ├─ primary   = ChatLiteLLM(ordered[0], ...)
    └─ fallbacks = [ChatLiteLLM(m, ...) for m in ordered[1:]]
         └─ primary.with_fallbacks(fallbacks, exceptions_to_handle=(Exception,))
```

The function signature is unchanged — all callers (`tutor.py`, future agents) call `get_llm()` with no awareness of routing.

---

## Shared conversation context

Every `get_llm()` call is potentially served by a different model. To preserve conversation coherence, `tutor_service.run_and_stream()` loads the prior `AgentMessage` rows for the session and passes them to `stream_tutor_answer()` before each call:

```
[SystemMessage(system_prompt)]
[HumanMessage(turn 1)]
[AIMessage(turn 1)]
[HumanMessage(turn 2)]
[AIMessage(turn 2)]
...
[HumanMessage(current question)]          ← always the last entry
```

History is capped at **20 rows (10 full turns)** to stay within the smallest model's context window (`groq/mixtral-8x7b-32768` at 32 k tokens — 10 tutor turns + system prompt + RAG chunks fits comfortably).

Because the full history is injected on every call, a student asking a follow-up gets a coherent answer regardless of which model the router selects — the model never needs prior state of its own.

---

## Configuration

All settings live in `backend/.env` (copy from `.env.example`).

| Env var | Type | Default | Description |
|---------|------|---------|-------------|
| `LLM_PRIMARY_MODEL` | `str` | `groq/llama-3.3-70b-versatile` | Preferred model (still enters the router pool — may not be primary on any given request if near its limit) |
| `LLM_FALLBACK_MODELS` | JSON list | 9 models (see `.env.example`) | Additional models in the pool |
| `LLM_TEMPERATURE` | `float` | `0.7` | Sampling temperature |
| `LLM_MAX_TOKENS` | `int` | `2048` | Max tokens per response |
| `LLM_MODEL_RPM_LIMITS` | JSON dict | `{}` | Per-model RPM overrides — use when upgrading a provider to a paid tier |

### Per-model override example

```bash
# Paid Groq tier: 600 RPM instead of the default 30
LLM_MODEL_RPM_LIMITS={"groq/llama-3.3-70b-versatile": 600}
```

### Supported provider prefixes and API keys

| Provider | Model prefix | Key env var |
|----------|-------------|-------------|
| OpenAI | _(none)_ e.g. `gpt-4o-mini` | `OPENAI_API_KEY` |
| Anthropic | `anthropic/` | `ANTHROPIC_API_KEY` |
| Google | `gemini/` | `GEMINI_API_KEY` |
| Groq | `groq/` | `GROQ_API_KEY` |
| OpenRouter | `openrouter/` | `OPENROUTER_API_KEY` |
| Ollama | `ollama/` | _(none — local)_ |

---

## Scaling to multiple replicas (Phase 2+)

The current counter is in-process (`threading.Lock` + `deque`). Two replicas each count their own traffic, so aggregate RPM is undercounted and the system can exceed provider limits.

The router's internal counter is behind a two-method interface:

```python
def record(self, model: str) -> None: ...
def _count_last_minute(self, model: str) -> int: ...
```

To make it replica-aware, replace the deque with a Redis sorted-set backend in these two methods. `get_ordered_models()` and all callers require no changes.

```python
# Redis sorted-set replacement sketch
def record(self, model: str) -> None:
    now = time.time()
    r.zadd(f"rpm:{model}", {str(now): now})
    r.zremrangebyscore(f"rpm:{model}", "-inf", now - 60)

def _count_last_minute(self, model: str) -> int:
    now = time.time()
    return r.zcount(f"rpm:{model}", now - 60, "+inf")
```

---

## Tests

`backend/tests/test_model_router.py` — 9 tests covering:

| Test | Verifies |
|------|---------|
| `test_fresh_router_full_headroom` | New router: all models start with full headroom |
| `test_record_shifts_order` | After recording requests, saturated model drops in rank |
| `test_stale_timestamps_expire` | Timestamps >60 s old are trimmed; headroom recovers |
| `test_config_override_respected` | `llm_model_rpm_limits` overrides the prefix default |
| `test_single_model_no_fallbacks` | One-model pool: router returns plain `ChatLiteLLM`, no chain |
| `test_all_models_saturated` | All at limit: least-loaded still returned, no exception |
| `test_headroom_negative_capped_correctly` | Over-limit model: negative headroom sorts last |
| `test_empty_override_dict` | Empty overrides: prefix defaults apply |
| `test_get_llm_uses_router_order` | Integration: `get_llm()` calls record on the top-ranked model |

Run: `cd backend && pytest tests/test_model_router.py -v`
