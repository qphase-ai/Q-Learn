"""Supabase Realtime publisher.

FastAPI publishes broadcast events to Supabase Realtime channels; the frontend
subscribes via the Supabase JS SDK (see `frontend/src/lib/supabase.ts`). There
are no WebSocket endpoints on the API — this keeps the API stateless and lets
events fan out across Railway replicas via Supabase as the shared broker.

Channel / event contract (kept in sync with the frontend subscriber):
- `circuit:{circuit_id}`  event `result`  payload = execution result dict
- `tutor:{session_id}`    event `token`   payload = {"token": str}
"""
import structlog

from app.core.supabase import get_supabase

logger = structlog.get_logger(__name__)


async def _broadcast(channel_name: str, event: str, payload: dict) -> None:
    """Send a single broadcast message to a Realtime channel.

    Failures are logged but never raised: a dropped realtime event must not fail
    the underlying operation (a circuit execution still succeeded even if the
    live update did not reach the client).
    """
    try:
        client = await get_supabase()
        channel = client.channel(channel_name)
        await channel.subscribe()
        await channel.send_broadcast(event, payload)
        await channel.unsubscribe()
    except Exception:  # noqa: BLE001 — realtime is best-effort, never fatal
        logger.warning("realtime_publish_failed", channel=channel_name, event=event)


async def publish_circuit_result(circuit_id: str, result: dict) -> None:
    """Publish a circuit execution result to `circuit:{circuit_id}`."""
    await _broadcast(f"circuit:{circuit_id}", "result", result)


async def publish_tutor_token(session_id: str, token: str) -> None:
    """Publish a single streamed tutor token to `tutor:{session_id}`."""
    await _broadcast(f"tutor:{session_id}", "token", {"token": token})
