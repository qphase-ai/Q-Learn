import time
import threading
from collections import defaultdict, deque

_DEFAULT_LIMITS: dict[str, int] = {
    "groq/":       30,
    "gemini/":     15,
    "openrouter/": 20,
}
_FALLBACK_LIMIT = 30


class ModelRouter:
    def __init__(self) -> None:
        self._windows: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _get_limit(self, model: str, overrides: dict[str, int] | None) -> int:
        if overrides and model in overrides:
            return overrides[model]
        for prefix, limit in _DEFAULT_LIMITS.items():
            if model.startswith(prefix):
                return limit
        return _FALLBACK_LIMIT

    def _trim(self, model: str) -> None:
        """Remove timestamps older than 60 s from this model's window. Lock must be held."""
        cutoff = time.monotonic() - 60.0
        window = self._windows[model]
        while window and window[0] < cutoff:
            window.popleft()

    def _count_last_minute(self, model: str) -> int:
        """Return current rolling RPM for model. Trims stale entries as a side effect."""
        with self._lock:
            self._trim(model)
            return len(self._windows[model])

    def record(self, model: str) -> None:
        """Record one request for model at the current time."""
        with self._lock:
            self._windows[model].append(time.monotonic())

    def get_ordered_models(
        self,
        models: list[str],
        overrides: dict[str, int] | None = None,
    ) -> list[str]:
        """Return models sorted by remaining RPM headroom, highest first."""
        with self._lock:
            ranked = []
            for model in models:
                self._trim(model)
                limit = self._get_limit(model, overrides)
                headroom = limit - len(self._windows[model])
                ranked.append((headroom, model))
        ranked.sort(key=lambda x: x[0], reverse=True)
        return [m for _, m in ranked]


_router: ModelRouter = ModelRouter()
