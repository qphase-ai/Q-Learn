import time
import threading
import pytest
from unittest.mock import patch
from app.agents.router import ModelRouter


def test_fresh_router_orders_by_limit():
    """Models with higher RPM limits have more headroom and sort first."""
    router = ModelRouter()
    models = [
        "gemini/gemini-2.0-flash",           # limit 15
        "openrouter/nvidia/nemotron:free",   # limit 20
        "groq/llama-3.3-70b-versatile",      # limit 30
    ]
    ordered = router.get_ordered_models(models)
    assert ordered[0] == "groq/llama-3.3-70b-versatile"
    assert ordered[1] == "openrouter/nvidia/nemotron:free"
    assert ordered[2] == "gemini/gemini-2.0-flash"


def test_record_shifts_order():
    """Saturating one model's window pushes it behind a lower-limit but empty model."""
    router = ModelRouter()
    models = ["groq/llama-3.3-70b-versatile", "gemini/gemini-2.0-flash"]
    # Saturate groq (limit 30)
    for _ in range(30):
        router.record("groq/llama-3.3-70b-versatile")
    ordered = router.get_ordered_models(models)
    # groq headroom = 0, gemini headroom = 15
    assert ordered[0] == "gemini/gemini-2.0-flash"
    assert ordered[1] == "groq/llama-3.3-70b-versatile"


def test_stale_timestamps_expire():
    """Timestamps older than 60 s are trimmed; headroom fully recovers."""
    router = ModelRouter()
    fake_time = [0.0]
    with patch("app.agents.router.time") as mock_time:
        mock_time.monotonic.side_effect = lambda: fake_time[0]
        # Record 30 requests at t=0
        for _ in range(30):
            router.record("groq/llama-3.3-70b-versatile")
        assert router._count_last_minute("groq/llama-3.3-70b-versatile") == 30
        # Advance 61 seconds — all entries now stale
        fake_time[0] = 61.0
        assert router._count_last_minute("groq/llama-3.3-70b-versatile") == 0


def test_config_override_respected():
    """llm_model_rpm_limits overrides the built-in prefix default."""
    router = ModelRouter()
    overrides = {"groq/llama-3.3-70b-versatile": 5}
    for _ in range(5):
        router.record("groq/llama-3.3-70b-versatile")
    ordered = router.get_ordered_models(
        ["groq/llama-3.3-70b-versatile", "gemini/gemini-2.0-flash"],
        overrides,
    )
    # groq: 5 limit, 5 used → 0 headroom; gemini: 15 limit, 0 used → 15 headroom
    assert ordered[0] == "gemini/gemini-2.0-flash"


def test_single_model_returned_unchanged():
    """With one model, get_ordered_models returns a list containing just that model."""
    router = ModelRouter()
    ordered = router.get_ordered_models(["groq/llama-3.3-70b-versatile"])
    assert ordered == ["groq/llama-3.3-70b-versatile"]


def test_all_models_saturated_no_exception():
    """When all models are at their RPM limit, the call still returns all models."""
    router = ModelRouter()
    models = ["groq/llama-3.3-70b-versatile", "gemini/gemini-2.0-flash"]
    for _ in range(30):
        router.record("groq/llama-3.3-70b-versatile")
    for _ in range(15):
        router.record("gemini/gemini-2.0-flash")
    ordered = router.get_ordered_models(models)
    assert len(ordered) == 2  # both models returned, no exception


def test_unknown_provider_gets_fallback_limit():
    """A model with no matching prefix uses the fallback limit of 30."""
    router = ModelRouter()
    # Record 25 groq requests (limit 30 → 5 headroom)
    for _ in range(25):
        router.record("groq/llama-3.3-70b-versatile")
    # unknown-provider has 30 headroom vs groq's 5
    ordered = router.get_ordered_models(
        ["groq/llama-3.3-70b-versatile", "gpt-4o-mini"]
    )
    assert ordered[0] == "gpt-4o-mini"


def test_thread_safety():
    """Concurrent record() calls from multiple threads produce consistent counts."""
    router = ModelRouter()
    model = "groq/llama-3.3-70b-versatile"
    threads = [threading.Thread(target=router.record, args=(model,)) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    count = router._count_last_minute(model)
    assert count == 10
