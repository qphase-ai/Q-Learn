"""Classroom realtime publishers: envelope, cached channel, token batcher. Hermetic."""
import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

import app.services.realtime_service as rt


class FakeChannel:
    def __init__(self, name):
        self.name = name
        self.subscribe = AsyncMock()
        self.unsubscribe = AsyncMock()
        self.send_broadcast = AsyncMock()


class FakeClient:
    def __init__(self):
        self.channels: list[FakeChannel] = []

    def channel(self, name):
        ch = FakeChannel(name)
        self.channels.append(ch)
        return ch


@pytest.fixture
def client(monkeypatch):
    c = FakeClient()
    monkeypatch.setattr(rt, "get_supabase", AsyncMock(return_value=c))
    rt._channels.clear()
    rt._channel_locks.clear()
    yield c
    rt._channels.clear()
    rt._channel_locks.clear()


SID, TID = str(uuid.uuid4()), str(uuid.uuid4())


async def test_envelope_shape_and_single_event_name(client):
    await rt.publish_classroom_status(SID, TID, "Teaching")
    ch = client.channels[0]
    assert ch.name == f"classroom:{SID}"
    event, env = ch.send_broadcast.await_args.args
    assert event == "classroom"
    assert set(env) == {"schema_version", "event_id", "session_id", "turn_id", "sequence_no", "type", "step_id", "payload"}
    assert env["schema_version"] == 1 and env["type"] == "agent.status" and env["payload"] == {"label": "Teaching"}
    assert env["sequence_no"] is None and env["session_id"] == SID and env["turn_id"] == TID


async def test_durable_action_carries_sequence_and_event_id(client):
    await rt.publish_classroom_action(SID, TID, {"action": "step_completed"}, 7, "evt-1", "step-1")
    env = client.channels[0].send_broadcast.await_args.args[1]
    assert (env["type"], env["sequence_no"], env["event_id"], env["step_id"]) == ("whiteboard.action", 7, "evt-1", "step-1")


async def test_completed_and_error_payloads(client):
    await rt.publish_classroom_completed(SID, TID, "m1", "hello")
    await rt.publish_classroom_error(SID, TID, "TURN_FAILED", "nope")
    envs = [c.args[1] for c in client.channels[0].send_broadcast.await_args_list]
    assert envs[0]["type"] == "message.completed" and envs[0]["payload"] == {"message_id": "m1", "content": "hello"}
    assert envs[1]["type"] == "classroom.error" and envs[1]["payload"] == {"code": "TURN_FAILED", "message": "nope"}


async def test_channel_is_subscribed_once_and_reused(client):
    for i in range(5):
        await rt.publish_classroom_status(SID, TID, f"s{i}")
    assert len(client.channels) == 1
    client.channels[0].subscribe.assert_awaited_once()
    assert client.channels[0].send_broadcast.await_count == 5
    client.channels[0].unsubscribe.assert_not_awaited()  # not per call, unlike _broadcast


async def test_concurrent_first_publishes_subscribe_once(client):
    await asyncio.gather(*[rt.publish_classroom_status(SID, TID, str(i)) for i in range(8)])
    assert len(client.channels) == 1 and client.channels[0].subscribe.await_count == 1


async def test_idle_channels_are_evicted(client):
    await rt.publish_classroom_status(SID, TID, "a")
    name = rt.classroom_channel_name(SID)
    ch, _ = rt._channels[name]
    rt._channels[name] = (ch, rt._channels[name][1] - rt.CHANNEL_IDLE_TTL_SECONDS - 1)
    await rt.publish_classroom_status(SID, TID, "b")
    ch.unsubscribe.assert_awaited_once()
    assert len(client.channels) == 2  # resubscribed on a fresh channel


async def test_failed_send_drops_cached_channel_and_never_raises(client):
    await rt.publish_classroom_status(SID, TID, "a")
    client.channels[0].send_broadcast.side_effect = RuntimeError("ws closed")
    await rt.publish_classroom_status(SID, TID, "b")  # must not raise
    assert rt.classroom_channel_name(SID) not in rt._channels
    await rt.publish_classroom_status(SID, TID, "c")
    assert len(client.channels) == 2


async def test_close_channel_unsubscribes(client):
    await rt.publish_classroom_status(SID, TID, "a")
    await rt.close_classroom_channel(SID)
    client.channels[0].unsubscribe.assert_awaited_once()
    assert not rt._channels


async def test_legacy_tutor_publisher_still_uses_per_call_broadcast(monkeypatch):
    spy = AsyncMock()
    monkeypatch.setattr(rt, "_broadcast", spy)
    await rt.publish_tutor_token("s", "x")
    spy.assert_awaited_once_with("tutor:s", "token", {"token": "x"})


# ---------------------------------------------------------------------------
# Token batcher
# ---------------------------------------------------------------------------

def _deltas(client):
    out = []
    for ch in client.channels:
        for c in ch.send_broadcast.await_args_list:
            env = c.args[1]
            if env["type"] == "message.delta":
                out.append(env)
    return out


async def test_batcher_coalesces_tokens_within_the_window(client):
    b = rt.ClassroomTokenBatcher(SID, TID, interval=0.05)
    for t in ["Hel", "lo ", "wor", "ld"]:
        await b.add(t)
    assert _deltas(client) == []  # nothing yet
    await asyncio.sleep(0.15)
    deltas = _deltas(client)
    assert len(deltas) == 1 and deltas[0]["payload"] == {"text": "Hello world"}
    assert deltas[0]["sequence_no"] is None


async def test_batcher_flush_sends_immediately_and_is_idempotent(client):
    b = rt.ClassroomTokenBatcher(SID, TID, interval=10)
    await b.add("abc")
    await b.flush()
    await b.flush()
    assert [d["payload"]["text"] for d in _deltas(client)] == ["abc"]


async def test_batcher_batches_across_windows_in_order(client):
    b = rt.ClassroomTokenBatcher(SID, TID, interval=0.05)
    await b.add("one ")
    await asyncio.sleep(0.12)
    await b.add("two")
    await b.flush()
    assert [d["payload"]["text"] for d in _deltas(client)] == ["one ", "two"]


async def test_batcher_discard_drops_buffer(client):
    b = rt.ClassroomTokenBatcher(SID, TID, interval=0.05)
    await b.add("secret")
    await b.discard()
    await asyncio.sleep(0.1)
    assert _deltas(client) == []
