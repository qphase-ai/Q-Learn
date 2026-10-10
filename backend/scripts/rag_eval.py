"""Golden-set retrieval eval: does `retrieve` find the right course material?

Runs every golden question through the same retrieval the tutor uses and
reports hit@1, hit@k, out-of-scope rejects, and each question's top dense
(cosine) similarity. Read-only.

    python -m scripts.rag_eval                          # against DATABASE_URL
    RAG_MIN_SCORE_FTS=0.25 python -m scripts.rag_eval   # try another floor

Expects the knowledge base loaded by `scripts.ingest_lessons` and
`scripts.seed_knowledge`. Exits 1 if an in-scope question misses at k or an
out-of-scope question retrieves anything (near-domain items are reported but
do not gate), so it can gate a deploy. Use it to calibrate `rag_min_score` and
`rag_min_score_fts`: floors that keep every in-scope hit while rejecting every
out-of-scope question.
"""
from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass
from types import SimpleNamespace

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.knowledge import KnowledgeEmbedding
from app.rag.embeddings import aembed_text
from app.rag.retrieval import RetrievalQuery, RetrievedChunk, retrieve
from app.services.tutor_service import _retrieval_text

HADAMARD = "The Hadamard Gate"
SUPERPOSITION = "Superposition"
BELL = "Bell States & Entanglement"
CIRCUITS = "Quantum Circuit Basics"  # the lesson and the IBM excerpt share this title
MEASUREMENT = "Measurement"


@dataclass(frozen=True)
class GoldenItem:
    question: str
    # Titles that count as a hit. Empty means out of scope: expect 0 chunks.
    expected: tuple[str, ...]
    # An earlier user turn, for follow-ups; folded in the way the tutor does it.
    prior_user_turn: str | None = None
    kind: str = "direct"
    # Non-gating items are reported but never fail the run (see "near-domain").
    gating: bool = True


GOLDEN: list[GoldenItem] = [
    # Direct questions.
    GoldenItem("What does the Hadamard gate do?", (HADAMARD,)),
    GoldenItem("What is superposition?", (SUPERPOSITION,)),
    GoldenItem("How do I prepare a Bell state?", (BELL,)),
    GoldenItem("What is a quantum circuit?", (CIRCUITS,)),
    GoldenItem("How do I measure a qubit in Qiskit?", (MEASUREMENT,)),
    GoldenItem("What is the Bloch sphere?", (SUPERPOSITION,)),
    GoldenItem("What does a CNOT gate do?", (CIRCUITS,)),
    # Paraphrases that avoid the documents' key terms.
    # The IBM circuits excerpt answers this too: "the Hadamard H (which creates
    # superposition)", and the circuits lesson tabulates H|0> = |+>.
    GoldenItem("How do I make a qubit 50/50?", (HADAMARD, CIRCUITS), kind="paraphrase"),
    GoldenItem(
        "Why do two linked qubits always give matching results when you read them?",
        (BELL,), kind="paraphrase",
    ),
    GoldenItem("Is applying H twice the same as doing nothing?", (HADAMARD,), kind="paraphrase"),
    GoldenItem(
        "How many classical values can a register of n qubits hold at once?",
        (SUPERPOSITION,), kind="paraphrase",
    ),
    GoldenItem(
        "Why do I get a histogram of results instead of a single answer when I run my circuit?",
        (MEASUREMENT,), kind="paraphrase",
    ),
    # Two-turn follow-ups: the current message alone is too vague to retrieve.
    GoldenItem(
        "why is it so important for algorithms?", (HADAMARD,),
        prior_user_turn="what does the hadamard gate do", kind="follow-up",
    ),
    GoldenItem(
        "and what happens to the other one if I measure the first?", (BELL,),
        prior_user_turn="how do I entangle two qubits", kind="follow-up",
    ),
    # Out of scope: nothing in the course covers these.
    GoldenItem("What is the capital of France?", (), kind="out-of-scope"),
    GoldenItem("How do I bake sourdough bread?", (), kind="out-of-scope"),
    GoldenItem("Explain how a transformer neural network uses attention.", (), kind="out-of-scope"),
    # Near-domain: quantum, but not in the course. Its best chunk scores like a
    # hard in-scope paraphrase, so no floor rejects it without losing those.
    # Reported, not gating; the tutor prompt says "not covered" when the sources
    # do not answer, and only cited sources become citations.
    GoldenItem("What is Shor's algorithm?", (), kind="near-domain", gating=False),
]


@dataclass
class ItemResult:
    item: GoldenItem
    chunks: list[RetrievedChunk]
    top_dense: float | None

    @property
    def titles(self) -> list[str]:
        return [c.title for c in self.chunks]

    @property
    def in_scope(self) -> bool:
        return bool(self.item.expected)

    @property
    def hit_at_1(self) -> bool:
        return bool(self.chunks) and self.chunks[0].title in self.item.expected

    @property
    def hit_at_k(self) -> bool:
        return any(t in self.item.expected for t in self.titles)

    @property
    def passed(self) -> bool:
        return self.hit_at_k if self.in_scope else not self.chunks

    @property
    def failed(self) -> bool:
        return self.item.gating and not self.passed


def query_text(item: GoldenItem) -> str:
    """The retrieval text the tutor would build for this turn."""
    prior = [SimpleNamespace(role="user", content=item.prior_user_turn)] if item.prior_user_turn else []
    return _retrieval_text(item.question, prior)


async def _top_dense(db: AsyncSession, text: str) -> float | None:
    """Best cosine similarity over the whole corpus, before any floor or fusion."""
    vec = await aembed_text(text)
    distance = await db.scalar(select(func.min(KnowledgeEmbedding.embedding.cosine_distance(vec))))
    return None if distance is None else 1.0 - float(distance)


async def evaluate(db: AsyncSession, golden: list[GoldenItem] = GOLDEN) -> list[ItemResult]:
    results = []
    for item in golden:
        text = query_text(item)
        chunks = await retrieve(db, RetrievalQuery(text=text))
        top = await _top_dense(db, text)
        await db.rollback()  # end the transaction that SET LOCAL hnsw.ef_search opened
        results.append(ItemResult(item=item, chunks=chunks, top_dense=top))
    return results


def report(results: list[ItemResult]) -> bool:
    """Print the per-question table and the summary. True when every item passed."""
    settings = get_settings()
    print(
        f"rag_min_score={settings.rag_min_score} rag_min_score_fts={settings.rag_min_score_fts} "
        f"rag_top_k={settings.rag_top_k}\n"
    )
    for r in results:
        mark = "PASS" if r.passed else ("FAIL" if r.item.gating else "INFO")
        top = "  n/a" if r.top_dense is None else f"{r.top_dense:.3f}"
        got = ", ".join(f"{c.title} ({c.score:.2f})" for c in r.chunks) or "-"
        print(f"{mark}  top_dense={top}  [{r.item.kind}] {r.item.question}")
        print(f"      got: {got}")

    in_scope = [r for r in results if r.in_scope]
    oos = [r for r in results if not r.in_scope and r.item.gating]
    near = [r for r in results if not r.in_scope and not r.item.gating]
    hit1 = sum(r.hit_at_1 for r in in_scope)
    hitk = sum(r.hit_at_k for r in in_scope)
    rejected = sum(not r.chunks for r in oos)
    print(
        f"\nhit@1 {hit1}/{len(in_scope)}  hit@{settings.rag_top_k} {hitk}/{len(in_scope)}  "
        f"out-of-scope rejected {rejected}/{len(oos)}"
        + (f"  (near-domain rejected {sum(not r.chunks for r in near)}/{len(near)}, not gating)" if near else "")
    )
    in_scope_top = [r.top_dense for r in in_scope if r.top_dense is not None]
    oos_top = [r.top_dense for r in oos if r.top_dense is not None]
    if in_scope_top and oos_top:
        print(
            f"top dense: in-scope min {min(in_scope_top):.3f}  "
            f"out-of-scope max {max(oos_top):.3f}"
        )
    return not any(r.failed for r in results)


async def _main() -> int:
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        results = await evaluate(db)
    return 0 if report(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
