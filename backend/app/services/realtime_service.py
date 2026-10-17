"""Supabase Realtime publisher.

FastAPI publishes broadcast events to Supabase Realtime channels; the frontend
subscribes via the Supabase JS SDK (see `frontend/src/lib/supabase.ts`). There
are no WebSocket endpoints on the API — this keeps the API stateless and lets
events fan out across API replicas via Supabase as the shared broker.

Channel / event contract (kept in sync with the frontend subscriber):
- `circuit:{circuit_id}`  event `result`    payload = execution result dict
- `tutor:{session_id}`    event `token`     payload = {"token": str}
- `tutor:{session_id}`    event `complete`  payload = {message_id, content, citations} | {error}
- `classroom:{session_id}` event `classroom` payload = envelope {schema_version, event_id,
  session_id, turn_id, sequence_no, type, step_id, payload}; see "AI Classroom" below.
"""
import asyncio
import time
import uuid

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


async def publish_tutor_complete(session_id: str, payload: dict) -> None:
    """Publish the terminal tutor event to `tutor:{session_id}`.

    On success `payload` carries {message_id, content, citations}; on failure it
    carries {error}. Either way the frontend uses `complete` to stop streaming.
    """
    await _broadcast(f"tutor:{session_id}", "complete", payload)


# ---------------------------------------------------------------------------
# AI Classroom — `classroom:{session_id}`, single event name `classroom`
#
# Unlike the per-call `_broadcast` above, classroom streaming sends many small
# messages per second, so the subscribed channel is cached per session (with an
# idle TTL) and message deltas are batched (~100 ms). The tutor/circuit
# publishers above are unchanged.
#
# Channels are public: the session UUID is the only secret. Events carry no
# secrets or PII (see docs/security.md).
# ---------------------------------------------------------------------------

CLASSROOM_EVENT = "classroom"
CHANNEL_IDLE_TTL_SECONDS = 300.0
DELTA_BATCH_SECONDS = 0.1

# channel name -> (channel, last_used monotonic time)
_channels: dict[str, tuple[object, float]] = {}
_channel_locks: dict[str, asyncio.Lock] = {}


def classroom_channel_name(session_id: str | uuid.UUID) -> str:
    return f"classroom:{session_id}"


async def _evict_idle_channels(now: float | None = None) -> None:
    """Unsubscribe channels idle longer than the TTL. Best-effort."""
    now = time.monotonic() if now is None else now
    for name in [n for n, (_, used) in _channels.items() if now - used > CHANNEL_IDLE_TTL_SECONDS]:
        channel, _ = _channels.pop(name)
        _channel_locks.pop(name, None)
        try:
            await channel.unsubscribe()
        except Exception:  # noqa: BLE001
            logger.warning("realtime_channel_unsubscribe_failed", channel=name)


async def _get_cached_channel(channel_name: str):
    entry = _channels.get(channel_name)
    if entry is not None:
        _channels[channel_name] = (entry[0], time.monotonic())
        return entry[0]
    lock = _channel_locks.setdefault(channel_name, asyncio.Lock())
    async with lock:
        entry = _channels.get(channel_name)
        if entry is None:
            client = await get_supabase()
            channel = client.channel(channel_name)
            await channel.subscribe()
            entry = (channel, time.monotonic())
        _channels[channel_name] = (entry[0], time.monotonic())
        return entry[0]


async def _broadcast_cached(channel_name: str, event: str, payload: dict) -> None:
    """Send on a cached, already-subscribed channel. Best-effort, never raises.

    On failure the channel is dropped from the cache so the next send resubscribes.
    """
    try:
        await _evict_idle_channels()
        channel = await _get_cached_channel(channel_name)
        await channel.send_broadcast(event, payload)
    except Exception:  # noqa: BLE001 — realtime is best-effort, never fatal
        _channels.pop(channel_name, None)
        logger.warning("realtime_publish_failed", channel=channel_name, realtime_event=event)


async def close_classroom_channel(session_id: str | uuid.UUID) -> None:
    """Unsubscribe and forget a session's cached channel (end of a run)."""
    name = classroom_channel_name(session_id)
    entry = _channels.pop(name, None)
    _channel_locks.pop(name, None)
    if entry is not None:
        try:
            await entry[0].unsubscribe()
        except Exception:  # noqa: BLE001
            logger.warning("realtime_channel_unsubscribe_failed", channel=name)


async def close_all_classroom_channels() -> None:
    for name in list(_channels):
        await close_classroom_channel(name.split(":", 1)[1])


async def publish_classroom_event(envelope: dict) -> None:
    """Publish one envelope to `classroom:{session_id}` (event name `classroom`)."""
    await _broadcast_cached(classroom_channel_name(envelope["session_id"]), CLASSROOM_EVENT, envelope)


def _envelope(session_id, turn_id, type_, payload, sequence_no=None, step_id=None, event_id=None) -> dict:
    from app.schemas.classroom import make_envelope

    return make_envelope(
        session_id=session_id,
        turn_id=turn_id,
        type=type_,
        payload=payload,
        sequence_no=sequence_no,
        step_id=step_id,
        event_id=event_id,
    )


async def publish_classroom_status(session_id, turn_id, label: str, step_id: str | None = None) -> None:
    await publish_classroom_event(_envelope(session_id, turn_id, "agent.status", {"label": label}, step_id=step_id))


async def publish_classroom_action(
    session_id, turn_id, payload: dict, sequence_no: int, event_id: str, step_id: str | None = None
) -> None:
    """A durable whiteboard action (already persisted with `sequence_no`)."""
    await publish_classroom_event(
        _envelope(session_id, turn_id, "whiteboard.action", payload, sequence_no=sequence_no, step_id=step_id, event_id=event_id)
    )


async def publish_classroom_completed(session_id, turn_id, message_id, content: str) -> None:
    await publish_classroom_event(
        _envelope(session_id, turn_id, "message.completed", {"message_id": str(message_id), "content": content})
    )


async def publish_classroom_error(session_id, turn_id, code: str, message: str) -> None:
    await publish_classroom_event(
        _envelope(session_id, turn_id, "classroom.error", {"code": code, "message": message})
    )


class ClassroomTokenBatcher:
    """Coalesces streamed tokens into one `message.delta` per ~100 ms.

    `add()` buffers text and arms a one-shot timer; `flush()` sends what is
    buffered immediately (call it before any ordered event and at end of stream).
    Deltas are not durable: sequence_no is null.
    """

    def __init__(self, session_id, turn_id, interval: float = DELTA_BATCH_SECONDS) -> None:
        self.session_id = str(session_id)
        self.turn_id = str(turn_id)
        self.interval = interval
        self._buffer: list[str] = []
        self._timer: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    async def add(self, text: str) -> None:
        self._buffer.append(text)
        if self._timer is None or self._timer.done():
            self._timer = asyncio.create_task(self._flush_later())

    async def _flush_later(self) -> None:
        await asyncio.sleep(self.interval)
        await self._send()

    async def _send(self) -> None:
        async with self._lock:
            if not self._buffer:
                return
            text, self._buffer = "".join(self._buffer), []
            await publish_classroom_event(_envelope(self.session_id, self.turn_id, "message.delta", {"text": text}))

    async def flush(self) -> None:
        # The pending timer (if any) later finds an empty buffer and does nothing;
        # not cancelling it avoids dropping a batch it is mid-way through sending.
        await self._send()

    async def discard(self) -> None:
        """Drop buffered text (superseded run) and stop the timer."""
        self._buffer.clear()
        timer, self._timer = self._timer, None
        if timer is not None and not timer.done():
            timer.cancel()
            try:
                await timer
            except asyncio.CancelledError:
                pass
