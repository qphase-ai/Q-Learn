"""Sandbox runner — the single point of contact with the Vercel Sandbox SDK.

Nothing else in the codebase imports the Vercel SDK directly. This mirrors the
"never import Qiskit outside app/quantum" rule: adapters and services depend on
this thin async seam, so the concrete provider (Vercel today; E2B/Modal/
microsandbox later) can be swapped in one place behind configuration.

The runner only *runs code and returns raw output* — it does not parse results.
Callers (e.g. QiskitAerAdapter) own interpreting stdout. A non-zero exit code or
empty stdout is surfaced to the caller via SandboxResult, not swallowed here.

Vercel Sandbox Python SDK (beta, package ``vercel-sandbox``):
    from vercel.api import session
    from vercel import sandbox
    async with session():
        async with sandbox.create_sandbox(...) as instance:
            proc = await instance.run_process("python", ["-c", code],
                                              capture_output=True)
            proc.stdout / proc.stderr / proc.exit_code

The SDK is imported lazily inside ``run_python`` so that importing this module
(and unit-testing callers by patching ``SandboxRunner.run_python``) never
requires the SDK or Vercel credentials to be present.
"""
from __future__ import annotations

from dataclasses import dataclass

import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)


@dataclass
class SandboxResult:
    stdout: str
    stderr: str
    exit_code: int


def _as_text(value: object) -> str:
    """Normalize an SDK stdout/stderr field that may be str, bytes, or None."""
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


class SandboxRunner:
    """Runs a Python snippet inside an isolated Vercel Sandbox microVM."""

    def __init__(self) -> None:
        self.settings = get_settings()

    async def run_python(self, code: str, timeout_ms: int | None = None) -> SandboxResult:
        """Execute ``code`` as ``python -c <code>`` in a fresh sandbox.

        Returns the captured stdout/stderr/exit_code. Raises only if the sandbox
        itself could not be created or the command could not be launched — a
        non-zero exit code from the script is a normal SandboxResult, left for
        the caller to interpret.
        """
        from vercel.api import session  # type: ignore[import-not-found]
        from vercel import sandbox  # type: ignore[import-not-found]
        from vercel.sandbox import SandboxResources  # type: ignore[import-not-found]

        timeout = timeout_ms if timeout_ms is not None else self.settings.sandbox_timeout

        create_kwargs: dict[str, object] = {
            "resources": SandboxResources(
                vcpus=self.settings.sandbox_vcpus,
                memory=self.settings.sandbox_memory,
            ),
            "timeout": timeout,
        }

        # Prefer a snapshot (warm, qiskit preinstalled); else a custom image.
        # If neither is configured, fall back to the SDK default image.
        if self.settings.sandbox_snapshot_id:
            from vercel.sandbox import SnapshotSource  # type: ignore[import-not-found]

            create_kwargs["source"] = SnapshotSource(
                snapshot_id=self.settings.sandbox_snapshot_id
            )
        elif self.settings.sandbox_image:
            create_kwargs["image"] = self.settings.sandbox_image

        async with session():
            async with sandbox.create_sandbox(**create_kwargs) as instance:
                proc = await instance.run_process(
                    "python", ["-c", code], capture_output=True
                )

        return SandboxResult(
            stdout=_as_text(getattr(proc, "stdout", "")),
            stderr=_as_text(getattr(proc, "stderr", "")),
            exit_code=int(getattr(proc, "exit_code", 0) or 0),
        )
