"""Proactive multi-limit LLM router.

Each model gets one continuously-refilling bucket per rate-limit dimension
(RPM, RPD, TPM, TPD). Groq refills limits continuously rather than resetting at a
clock boundary — after one request against a 1,000 RPD model,
`x-ratelimit-reset-requests` reads 86.4s (= 86,400s / 1,000) — so a refill-rate
bucket tracks its accounting closely. Local estimates are corrected from Groq's
`x-ratelimit-remaining-*` response headers whenever a response carries them.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, replace

_DAY_SECONDS = 86_400.0

# Models whose remaining daily budget falls below this fraction are ranked behind
# models that still have daily headroom, so the last slice of a daily quota is only
# spent when nothing else can take the request.
_DAILY_RESERVE = 0.10

_DEFAULT_COOLDOWN_SECONDS = 10.0
# Non-429 failures (bad key, unreachable provider, retired model) rarely clear within
# seconds; without a cooldown every request would pay a doomed round-trip first.
ERROR_COOLDOWN_SECONDS = 60.0


@dataclass(frozen=True)
class ModelLimits:
    rpm: int | None = None
    rpd: int | None = None
    tpm: int | None = None
    tpd: int | None = None


# Groq free tier. gpt-oss/qwen values were confirmed against live response headers
# (x-ratelimit-limit-requests = RPD, x-ratelimit-limit-tokens = TPM); the rest are
# from https://console.groq.com/docs/rate-limits.
_MODEL_LIMITS: dict[str, ModelLimits] = {
    "groq/openai/gpt-oss-120b":             ModelLimits(rpm=30, rpd=1_000, tpm=8_000, tpd=200_000),
    "groq/openai/gpt-oss-20b":              ModelLimits(rpm=30, rpd=1_000, tpm=8_000, tpd=200_000),
    "groq/openai/gpt-oss-safeguard-20b":    ModelLimits(rpm=30, rpd=1_000, tpm=8_000, tpd=200_000),
    "groq/qwen/qwen3.8-27b":                ModelLimits(rpm=30, rpd=1_000, tpm=8_000, tpd=200_000),
    "groq/meta-llama/llama-prompt-guard-2-22m": ModelLimits(rpm=30, rpd=14_400, tpm=15_000, tpd=500_000),
    "groq/meta-llama/llama-prompt-guard-2-86m": ModelLimits(rpm=30, rpd=14_400, tpm=15_000, tpd=500_000),
    "groq/whisper-large-v3":                ModelLimits(rpm=20, rpd=2_000),
    "groq/whisper-large-v3-turbo":          ModelLimits(rpm=20, rpd=2_000),
    "groq/canopylabs/orpheus-v1-english":   ModelLimits(rpm=10, rpd=100, tpm=1_200, tpd=3_600),
    "groq/canopylabs/orpheus-arabic-saudi": ModelLimits(rpm=10, rpd=100, tpm=1_200, tpd=3_600),
}

_PREFIX_LIMITS: dict[str, ModelLimits] = {
    "groq/":       ModelLimits(rpm=30, rpd=1_000),
    "gemini/":     ModelLimits(rpm=15),
    "openrouter/": ModelLimits(rpm=20, rpd=50),
}
_FALLBACK_LIMITS = ModelLimits(rpm=30)


class _Bucket:
    """Continuously refilling capacity: `capacity` units, refilled over `period` seconds."""

    __slots__ = ("capacity", "rate", "level", "updated")

    def __init__(self, capacity: float, period: float, now: float) -> None:
        self.capacity = capacity
        self.rate = capacity / period
        self.level = capacity
        self.updated = now

    def available(self, now: float) -> float:
        self.level = min(self.capacity, self.level + (now - self.updated) * self.rate)
        self.updated = now
        return self.level

    def consume(self, amount: float, now: float) -> None:
        self.available(now)
        self.level -= amount  # may go negative: debt repaid by refill

    def sync(self, remaining: float, now: float) -> None:
        self.level = min(self.capacity, remaining)
        self.updated = now

    def seconds_until(self, amount: float, now: float) -> float:
        deficit = amount - self.available(now)
        return 0.0 if deficit <= 0 else deficit / self.rate


class _ModelState:
    __slots__ = ("limits", "rpm", "rpd", "tpm", "tpd", "cooldown_until")

    def __init__(self, limits: ModelLimits, now: float) -> None:
        self.limits = limits
        self.rpm = _Bucket(limits.rpm, 60.0, now) if limits.rpm else None
        self.rpd = _Bucket(limits.rpd, _DAY_SECONDS, now) if limits.rpd else None
        self.tpm = _Bucket(limits.tpm, 60.0, now) if limits.tpm else None
        self.tpd = _Bucket(limits.tpd, _DAY_SECONDS, now) if limits.tpd else None
        self.cooldown_until = 0.0

    def request_buckets(self) -> list[_Bucket]:
        return [b for b in (self.rpm, self.rpd) if b]

    def token_buckets(self) -> list[_Bucket]:
        return [b for b in (self.tpm, self.tpd) if b]

    def daily_buckets(self) -> list[_Bucket]:
        return [b for b in (self.rpd, self.tpd) if b]


def resolve_limits(model: str, overrides: dict[str, dict[str, int]] | None = None) -> ModelLimits:
    """Built-in limits for `model`, with any fields in `overrides[model]` replacing them."""
    base = _MODEL_LIMITS.get(model)
    if base is None:
        base = next(
            (lim for prefix, lim in _PREFIX_LIMITS.items() if model.startswith(prefix)),
            _FALLBACK_LIMITS,
        )
    if overrides and model in overrides:
        base = replace(base, **overrides[model])
    return base


class ModelRouter:
    def __init__(self, overrides: dict[str, dict[str, int]] | None = None) -> None:
        self._overrides = overrides or {}
        self._states: dict[str, _ModelState] = {}
        self._lock = threading.Lock()

    def configure(self, overrides: dict[str, dict[str, int]] | None) -> None:
        """Apply limit overrides; models whose limits change restart with full buckets."""
        overrides = overrides or {}
        with self._lock:
            if overrides == self._overrides:
                return
            self._overrides = overrides
            self._states.clear()

    def _state(self, model: str, now: float) -> _ModelState:
        state = self._states.get(model)
        if state is None:
            state = _ModelState(resolve_limits(model, self._overrides), now)
            self._states[model] = state
        return state

    def _wait_seconds(self, state: _ModelState, tokens: float, now: float) -> float:
        waits = [state.cooldown_until - now]
        waits += [b.seconds_until(1, now) for b in state.request_buckets()]
        waits += [b.seconds_until(tokens, now) for b in state.token_buckets()]
        return max(0.0, *waits)

    @staticmethod
    def _headroom(state: _ModelState, tokens: float, now: float) -> float:
        """Smallest remaining fraction across all dimensions after this request."""
        fractions = [(b.available(now) - 1) / b.capacity for b in state.request_buckets()]
        fractions += [(b.available(now) - tokens) / b.capacity for b in state.token_buckets()]
        return min(fractions, default=1.0)

    @staticmethod
    def _daily_fraction(state: _ModelState, now: float) -> float:
        return min((b.available(now) / b.capacity for b in state.daily_buckets()), default=1.0)

    def get_ordered_models(self, models: list[str], est_tokens: int = 0) -> list[str]:
        """Order models for a request expected to use `est_tokens` tokens.

        1. Ready now, daily budget above the reserve.
        2. Ready now, but daily budget inside the reserve.
        3. Not ready (a bucket is short, or cooling down) — soonest ready first.

        Within tiers 1 and 2, providers keep the order they first appear in `models`
        and models of the same provider are balanced by headroom. Headroom is not
        compared across providers: they track different dimensions, so a provider
        with no known TPM limit would otherwise always look emptier than Groq.
        """
        now = time.monotonic()
        provider_rank: dict[str, int] = {}
        for model in models:
            provider_rank.setdefault(_provider(model), len(provider_rank))

        ready, reserve, waiting = [], [], []
        with self._lock:
            for model in models:
                state = self._state(model, now)
                wait = self._wait_seconds(state, est_tokens, now)
                if wait > 0:
                    waiting.append((wait, model))
                    continue
                key = (provider_rank[_provider(model)], -self._headroom(state, est_tokens, now), model)
                if self._daily_fraction(state, now) > _DAILY_RESERVE:
                    ready.append(key)
                else:
                    reserve.append(key)
        return [k[-1] for k in sorted(ready) + sorted(reserve) + sorted(waiting)]

    def record(self, model: str, tokens: int = 0) -> None:
        """Count one request (and `tokens` tokens) against `model`."""
        now = time.monotonic()
        with self._lock:
            state = self._state(model, now)
            for b in state.request_buckets():
                b.consume(1, now)
            for b in state.token_buckets():
                b.consume(tokens, now)

    def adjust_tokens(self, model: str, delta: int) -> None:
        """Correct a token estimate after the fact; negative `delta` refunds tokens."""
        now = time.monotonic()
        with self._lock:
            state = self._state(model, now)
            for b in state.token_buckets():
                if delta >= 0:
                    b.consume(delta, now)
                else:
                    b.sync(b.available(now) - delta, now)

    def sync_from_headers(self, model: str, headers: dict[str, str]) -> None:
        """Adopt Groq's authoritative remaining counts (requests header = RPD, tokens = TPM)."""
        now = time.monotonic()
        with self._lock:
            state = self._state(model, now)
            for header, bucket in (
                ("x-ratelimit-remaining-requests", state.rpd),
                ("x-ratelimit-remaining-tokens", state.tpm),
            ):
                value = _header(headers, header)
                if bucket is not None and value is not None:
                    try:
                        bucket.sync(float(value), now)
                    except ValueError:
                        pass

    def mark_unavailable(self, model: str, seconds: float) -> None:
        """Take `model` out of rotation for `seconds`."""
        now = time.monotonic()
        with self._lock:
            state = self._state(model, now)
            state.cooldown_until = max(state.cooldown_until, now + seconds)

    def mark_rate_limited(self, model: str, headers: dict[str, str] | None = None) -> None:
        """Take `model` out of rotation until the provider's retry-after elapses."""
        retry_after = _header(headers or {}, "retry-after")
        try:
            seconds = float(retry_after) if retry_after is not None else _DEFAULT_COOLDOWN_SECONDS
        except ValueError:
            seconds = _DEFAULT_COOLDOWN_SECONDS
        self.mark_unavailable(model, seconds)
        if headers:
            self.sync_from_headers(model, headers)

    def snapshot(self, model: str) -> dict[str, float | None]:
        """Current available capacity per dimension — for logging, tests, and debugging."""
        now = time.monotonic()
        with self._lock:
            state = self._state(model, now)
            return {
                name: (b.available(now) if b else None)
                for name, b in (("rpm", state.rpm), ("rpd", state.rpd), ("tpm", state.tpm), ("tpd", state.tpd))
            } | {"cooldown": max(0.0, state.cooldown_until - now)}


def _provider(model: str) -> str:
    return model.split("/", 1)[0] if "/" in model else "openai"


def _header(headers: dict[str, str], name: str) -> str | None:
    """Look up a rate-limit header whether LiteLLM kept it bare or prefixed it `llm_provider-`."""
    for key in (name, f"llm_provider-{name}"):
        if key in headers:
            return headers[key]
    lowered = {k.lower(): v for k, v in headers.items()}
    return lowered.get(name) or lowered.get(f"llm_provider-{name}")


_router: ModelRouter = ModelRouter()
