import sentry_sdk

from app.config import Settings
from app.core.sentry import _scrub_event, init_sentry


def _settings(**overrides) -> Settings:
    base = dict(
        secret_key="test-secret",
        database_url="postgresql+asyncpg://postgres:postgres@localhost:5432/qlearn",
        supabase_url="https://example.supabase.co",
        supabase_service_key="service-key",
        supabase_anon_key="anon-key",
    )
    base.update(overrides)
    return Settings(**base)


def test_init_sentry_is_noop_without_dsn(monkeypatch):
    called = False

    def _fail_if_called(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(sentry_sdk, "init", _fail_if_called)
    init_sentry(_settings(sentry_dsn=""))
    assert called is False


def test_init_sentry_initializes_client_with_dsn():
    init_sentry(
        _settings(
            sentry_dsn="https://public@o0.ingest.sentry.io/0",
            sentry_environment="test",
            sentry_traces_sample_rate=0.1,
        )
    )
    try:
        assert sentry_sdk.is_initialized()
        client = sentry_sdk.get_client()
        assert client.options["environment"] == "test"
        assert client.options["traces_sample_rate"] == 0.1
        assert client.options["send_default_pii"] is False
        assert client.options["include_local_variables"] is False
        assert client.options["before_send"] is _scrub_event
        assert client.options["before_send_transaction"] is _scrub_event
    finally:
        sentry_sdk.get_global_scope().client = sentry_sdk.Client()


def test_scrub_event_strips_sensitive_headers():
    event = {
        "request": {
            "headers": {
                "Authorization": "Bearer secret-token",
                "Cookie": "session=abc",
                "User-Agent": "pytest",
            },
            "data": {"password": "hunter2"},
            "cookies": {"session": "abc"},
            "query_string": "token=secret123",
        }
    }

    scrubbed = _scrub_event(event, {})

    headers = scrubbed["request"]["headers"]
    assert "Authorization" not in headers
    assert "Cookie" not in headers
    assert headers["User-Agent"] == "pytest"
    assert "data" not in scrubbed["request"]
    assert "cookies" not in scrubbed["request"]
    assert "query_string" not in scrubbed["request"]
