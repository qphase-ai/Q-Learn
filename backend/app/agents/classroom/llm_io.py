"""Thin LLM helpers shared by the classroom agents.

`get_llm()` returns a fallback-wrapped Runnable that has no `with_structured_output`,
so JSON is requested in the prompt, extracted here, then validated with Pydantic
by the caller.
"""
from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from app.agents.llm import estimate_tokens, get_llm
from app.config import get_settings

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def message_text(msg: Any) -> str:
    """Plain text of a chat message/chunk (content may be a string or parts)."""
    content = getattr(msg, "content", msg)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            p if isinstance(p, str) else (p.get("text", "") if isinstance(p, dict) else "") for p in content
        )
    return str(content or "")


def extract_json(text: str) -> Any:
    """Parse the first JSON object/array in `text` (tolerates fences and prose)."""
    candidate = text.strip()
    fenced = _FENCE_RE.search(candidate)
    if fenced:
        candidate = fenced.group(1).strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass
    decoder = json.JSONDecoder()
    for i, ch in enumerate(candidate):
        if ch in "{[":
            try:
                obj, _ = decoder.raw_decode(candidate[i:])
                return obj
            except json.JSONDecodeError:
                continue
    raise ValueError("no JSON found in model output")


def build_llm(messages: list[BaseMessage], temperature: float | None = None):
    return get_llm(
        temperature=temperature,
        est_tokens=estimate_tokens(messages, get_settings().llm_max_tokens),
    )


async def llm_json(system: str, user: str, temperature: float = 0.2) -> Any:
    """One LLM call that must answer with JSON. Raises ValueError on unparseable output."""
    messages: list[BaseMessage] = [SystemMessage(content=system), HumanMessage(content=user)]
    llm = build_llm(messages, temperature)
    reply = await llm.ainvoke(messages)
    return extract_json(message_text(reply))
