import threading
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import litellm
import pytest

from app.agents.router import ModelLimits, ModelRouter, resolve_limits

GPT120 = "groq/openai/gpt-oss-120b"
GPT20 = "groq/openai/gpt-oss-20b"
QWEN = "groq/qwen/qwen3.8-27b"
GEMINI = "gemini/gemini-3.8-flash"
OPENROUTER = "openrouter/nvidia/nemotron:free"


@pytest.fixture
def clock():
    """Controllable time.monotonic() for the router module."""
    now = [1_000.0]
    with patch("app.agents.router.time") as mock_time:
        mock_time.monotonic.side_effect = lambda: now[0]
        yield now


# --- limit resolution -------------------------------------------------------

def test_resolve_limits_exact_prefix_and_fallback():
    assert resolve_limits(GPT120) == ModelLimits(rpm=30, rpd=1_000, tpm=8_000, tpd=200_000)
    assert resolve_limits("groq/some-new-model") == ModelLimits(rpm=30, rpd=1_000)
    assert resolve_limits(GEMINI) == ModelLimits(rpm=15)
    assert resolve_limits("gpt-4o-mini") == ModelLimits(rpm=30)


def test_llm_model_limits_rejects_unknown_keys_at_settings_load():
    """A typo like "RPM" must fail at startup, not inside every get_llm() call."""
    from pydantic import ValidationError

    from app.config import Settings, get_settings

    base = get_settings().model_dump()
    with pytest.raises(ValidationError, match="unknown keys"):
        Settings(**{**base, "llm_model_limits": {GPT120: {"RPM": 1_000}}})
    ok = Settings(**{**base, "llm_model_limits": {GPT120: {"rpm": 1_000, "tpm": 250_000}}})
    assert ok.llm_model_limits[GPT120]["rpm"] == 1_000


def test_resolve_limits_partial_override_keeps_other_fields():
    limits = resolve_limits(GPT120, {GPT120: {"rpm": 1_000, "tpm": 250_000}})
    assert limits == ModelLimits(rpm=1_000, rpd=1_000, tpm=250_000, tpd=200_000)


# --- ordering ---------------------------------------------------------------

def test_providers_keep_pool_order():
    ordered = ModelRouter().get_ordered_models([GPT120, QWEN, GEMINI, OPENROUTER])
    assert ordered == [GPT120, QWEN, GEMINI, OPENROUTER]


def test_groq_not_displaced_by_providers_without_token_limits():
    """Regression: a 2k-token reservation leaves Groq at 74% TPM headroom, which must
    not rank it behind Gemini/OpenRouter (no TPM tracked, ~95% 'headroom')."""
    router = ModelRouter()
    router.record(GPT120, tokens=2_000)
    router.record(GPT20, tokens=2_000)
    ordered = router.get_ordered_models([GPT120, GPT20, OPENROUTER, GEMINI], est_tokens=2_000)
    assert set(ordered[:2]) == {GPT120, GPT20}


def test_overflow_to_next_provider_when_groq_not_ready():
    router = ModelRouter()
    router.record(GPT120, tokens=7_000)
    ordered = router.get_ordered_models([GPT120, GEMINI], est_tokens=2_000)
    assert ordered == [GEMINI, GPT120]


def test_record_spreads_load_across_models():
    router = ModelRouter()
    router.record(GPT120)
    assert router.get_ordered_models([GPT120, GPT20])[0] == GPT20


def test_token_budget_exhaustion_moves_model_behind_others():
    """A model with RPM to spare but too little TPM for this request is not picked."""
    router = ModelRouter()
    router.record(GPT120, tokens=7_000)  # 1,000 TPM left
    ordered = router.get_ordered_models([GPT120, QWEN], est_tokens=2_000)
    assert ordered == [QWEN, GPT120]


def test_token_bucket_refills_continuously(clock):
    router = ModelRouter()
    router.record(GPT120, tokens=8_000)
    assert router.snapshot(GPT120)["tpm"] == pytest.approx(0)
    clock[0] += 30  # half a minute refills half the TPM
    assert router.snapshot(GPT120)["tpm"] == pytest.approx(4_000)
    clock[0] += 60
    assert router.snapshot(GPT120)["tpm"] == pytest.approx(8_000)  # capped at capacity


def test_daily_budget_refills_at_rpd_per_day(clock):
    router = ModelRouter()
    router.record(GPT120)
    clock[0] += 86.4  # Groq's observed reset time for one request at 1,000 RPD
    assert router.snapshot(GPT120)["rpd"] == pytest.approx(1_000)


def test_daily_reserve_ranks_model_behind_ones_with_daily_headroom():
    router = ModelRouter()
    router.sync_from_headers(GPT120, {"x-ratelimit-remaining-requests": "50"})  # 5% of RPD left
    for _ in range(20):
        router.record(QWEN)  # busier this minute, but plenty of daily budget
    assert router.get_ordered_models([GPT120, QWEN]) == [QWEN, GPT120]


def test_reserve_model_still_preferred_over_unavailable_model():
    router = ModelRouter()
    router.sync_from_headers(GPT120, {"x-ratelimit-remaining-requests": "50"})
    for _ in range(30):
        router.record(QWEN)  # RPM exhausted
    assert router.get_ordered_models([QWEN, GPT120]) == [GPT120, QWEN]


def test_saturated_models_still_returned_soonest_ready_first():
    router = ModelRouter()
    for _ in range(30):
        router.record(GPT120)
    for _ in range(15):
        router.record(GEMINI)
    # both RPM-exhausted; gemini refills 1 req in 4s, groq in 2s
    assert router.get_ordered_models([GEMINI, GPT120]) == [GPT120, GEMINI]


def test_single_model_returned_unchanged():
    assert ModelRouter().get_ordered_models([GPT120]) == [GPT120]


# --- feedback from responses ------------------------------------------------

def test_rate_limited_model_cools_down_for_retry_after(clock):
    router = ModelRouter()
    router.mark_rate_limited(GPT120, {"retry-after": "5"})
    assert router.get_ordered_models([GPT120, GEMINI]) == [GEMINI, GPT120]
    clock[0] += 6
    assert router.get_ordered_models([GPT120, GEMINI]) == [GPT120, GEMINI]


def test_sync_from_headers_accepts_litellm_prefixed_keys(clock):
    router = ModelRouter()
    router.sync_from_headers(GPT120, {
        "llm_provider-x-ratelimit-remaining-requests": "123",
        "llm_provider-x-ratelimit-remaining-tokens": "456",
    })
    snap = router.snapshot(GPT120)
    assert snap["rpd"] == pytest.approx(123)
    assert snap["tpm"] == pytest.approx(456)


def test_adjust_tokens_refunds_overestimate(clock):
    router = ModelRouter()
    router.record(GPT120, tokens=5_000)
    router.adjust_tokens(GPT120, -4_000)  # actually used 1,000
    assert router.snapshot(GPT120)["tpm"] == pytest.approx(7_000)


def test_configure_overrides_raise_capacity(clock):
    router = ModelRouter()
    router.configure({GPT120: {"rpm": 300}})
    for _ in range(100):
        router.record(GPT120)
    assert router.snapshot(GPT120)["rpm"] == pytest.approx(200)


def test_thread_safety(clock):
    router = ModelRouter()
    threads = [threading.Thread(target=router.record, args=(GPT120,)) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert router.snapshot(GPT120)["rpm"] == pytest.approx(20)


# --- get_llm + usage callback -----------------------------------------------

def _settings(primary, fallbacks):
    s = MagicMock()
    s.llm_primary_model = primary
    s.llm_fallback_models = fallbacks
    s.llm_temperature = 0.7
    s.llm_max_tokens = 2048
    s.llm_model_limits = {}
    return s


def test_get_llm_reserves_estimate_on_top_ranked_model(clock):
    router = ModelRouter()
    for _ in range(30):
        router.record(GPT120)  # saturated → GPT20 should lead
    captured = []

    def fake_make_llm(model, temp, settings, route_meta):
        captured.append((model, route_meta))
        return MagicMock()

    with patch("app.agents.llm.get_settings", return_value=_settings(GPT120, [GPT20])), \
         patch("app.agents.llm._make_llm", side_effect=fake_make_llm), \
         patch("app.agents.llm._router", router):
        from app.agents.llm import get_llm
        get_llm(est_tokens=3_000)

    assert [m for m, _ in captured] == [GPT20, GPT120]
    assert captured[0][1] == {"reserved_model": GPT20, "reserved_tokens": 3_000}
    assert router.snapshot(GPT20)["tpm"] == pytest.approx(5_000)


def _callback_kwargs(model, reserved_model, reserved_tokens, **extra):
    meta = {"qlearn_router": {"model": model, "reserved_model": reserved_model, "reserved_tokens": reserved_tokens}}
    return {"litellm_params": {"metadata": meta}, **extra}


def test_success_callback_reconciles_reservation_and_syncs_headers(clock):
    from app.agents.llm import RouterUsageLogger

    router = ModelRouter()
    router.record(GPT120, tokens=3_000)
    response = SimpleNamespace(
        usage=SimpleNamespace(total_tokens=1_200),
        _hidden_params={"additional_headers": {"x-ratelimit-remaining-requests": "900"}},
    )
    with patch("app.agents.llm._router", router):
        RouterUsageLogger().log_success_event(_callback_kwargs(GPT120, GPT120, 3_000), response, None, None)

    snap = router.snapshot(GPT120)
    assert snap["tpm"] == pytest.approx(8_000 - 1_200)
    assert snap["rpd"] == pytest.approx(900)


def test_success_callback_excludes_cached_prompt_tokens(clock):
    """Groq doesn't count cached prompt tokens toward rate limits."""
    from app.agents.llm import RouterUsageLogger

    router = ModelRouter()
    response = SimpleNamespace(
        usage=SimpleNamespace(total_tokens=2_000, prompt_tokens_details=SimpleNamespace(cached_tokens=1_500)),
        _hidden_params={},
    )
    with patch("app.agents.llm._router", router):
        RouterUsageLogger().log_success_event(_callback_kwargs(QWEN, GPT120, 3_000), response, None, None)

    assert router.snapshot(QWEN)["tpm"] == pytest.approx(8_000 - 500)


def test_success_callback_charges_fallback_that_served(clock):
    from app.agents.llm import RouterUsageLogger

    router = ModelRouter()
    response = SimpleNamespace(usage=SimpleNamespace(total_tokens=500), _hidden_params={})
    with patch("app.agents.llm._router", router):
        RouterUsageLogger().log_success_event(_callback_kwargs(QWEN, GPT120, 3_000), response, None, None)

    snap = router.snapshot(QWEN)
    assert snap["rpm"] == pytest.approx(29)
    assert snap["tpm"] == pytest.approx(7_500)


def test_failure_callback_cools_down_broken_model_for_60s(clock):
    """Auth/connection/not-found errors take the model out of rotation, so later
    requests don't pay a doomed round-trip first."""
    from app.agents.llm import RouterUsageLogger

    router = ModelRouter()
    exc = litellm.AuthenticationError(message="bad key", llm_provider="openrouter", model="x")
    with patch("app.agents.llm._router", router):
        RouterUsageLogger().log_failure_event(
            _callback_kwargs(OPENROUTER, GPT120, 3_000, exception=exc), None, None, None
        )

    assert router.snapshot(OPENROUTER)["cooldown"] == pytest.approx(60)
    assert router.get_ordered_models([OPENROUTER, GEMINI]) == [GEMINI, OPENROUTER]


def test_failure_callback_refunds_tokens_and_cools_down_on_429(clock):
    from app.agents.llm import RouterUsageLogger

    router = ModelRouter()
    router.record(GPT120, tokens=3_000)
    exc = litellm.RateLimitError(
        message="rate limited",
        llm_provider="groq",
        model="openai/gpt-oss-120b",
        response=httpx.Response(429, headers={"retry-after": "7"}),
    )
    with patch("app.agents.llm._router", router):
        RouterUsageLogger().log_failure_event(
            _callback_kwargs(GPT120, GPT120, 3_000, exception=exc), None, None, None
        )

    snap = router.snapshot(GPT120)
    assert snap["tpm"] == pytest.approx(8_000)
    assert snap["cooldown"] == pytest.approx(7, abs=0.5)
