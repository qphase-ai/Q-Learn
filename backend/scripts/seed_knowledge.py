"""Seed the RAG knowledge base with trimmed Qiskit-documentation excerpts.

Safe to re-run against a database with the knowledge tables + pgvector:

    python -m scripts.seed_knowledge

Lessons are not seeded here: `python -m scripts.ingest_lessons` ingests them
from the `lessons` table. Each excerpt carries a `source_url` so the tutor can
cite it, and re-ingesting a source_url replaces the old copy. The seed also
removes the lesson duplicates that earlier versions of this script inserted
(LEGACY_LESSON_URLS); that is a no-op once they are gone.
`all-MiniLM-L6-v2` downloads on first use.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import KnowledgeDocument
from app.rag.ingestion import ingest_document


# ---------------------------------------------------------------------------
# Curated corpus
# ---------------------------------------------------------------------------

_CIRCUITS = r"""# Quantum Circuit Basics

A quantum circuit is a model for quantum computation: qubits are the wires and
quantum gates are the operations applied along those wires, read left-to-right
in time order.

Common single-qubit gates include the identity I, the bit-flip X (which maps
|0> to |1>), the Hadamard H (which creates superposition), and the phase-flip Z.
The Controlled-NOT (CNOT) is a two-qubit gate that flips the target qubit if and
only if the control qubit is |1>. Placing a measurement on a qubit collapses it
to |0> or |1> with probabilities |alpha|^2 and |beta|^2 respectively.
"""

_MEASUREMENT = r"""# Measurement in Quantum Computing

Measurement extracts classical information from a quantum state. Measuring a
qubit in superposition alpha|0> + beta|1> yields outcome 0 with probability
|alpha|^2 and outcome 1 with probability |beta|^2, and irreversibly collapses
the state onto the measured basis state.

In Qiskit you add a measurement with circuit.measure(qubit, clbit), which stores
the classical outcome in a classical register. Running many shots builds a
histogram of outcomes that approximates the underlying probability distribution.
Because measurement is probabilistic and destructive, algorithms are designed so
that the desired answer is the most probable measurement outcome.
"""


CORPUS: list[dict] = [
    {
        "title": "Quantum Circuit Basics",
        "source_url": "https://docs.quantum.ibm.com/guides/construct-circuits",
        "source_type": "documentation",
        "text": _CIRCUITS,
    },
    {
        "title": "Measurement",
        "source_url": "https://docs.quantum.ibm.com/guides/measure-qubits",
        "source_type": "documentation",
        "text": _MEASUREMENT,
    },
]


# Lesson copies inserted by earlier versions of this seed. The same lessons now
# come from scripts.ingest_lessons (qlearn://lesson/<id>), so these are duplicates.
LEGACY_LESSON_URLS: tuple[str, ...] = (
    "https://qlearn.dev/lessons/superposition",
    "https://qlearn.dev/lessons/hadamard",
    "https://qlearn.dev/lessons/entanglement",
)


@dataclass
class SeedResult:
    ingested: int
    removed_legacy: int


async def remove_legacy_lesson_documents(db: AsyncSession) -> int:
    """Delete the legacy lesson duplicates (chunks and embeddings cascade)."""
    result = await db.execute(
        delete(KnowledgeDocument)
        .where(KnowledgeDocument.source_url.in_(LEGACY_LESSON_URLS))
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    return result.rowcount or 0


async def seed(db: AsyncSession) -> SeedResult:
    """Remove legacy lesson duplicates, then (re-)ingest every corpus document."""
    removed = await remove_legacy_lesson_documents(db)
    for doc in CORPUS:
        await ingest_document(
            db,
            title=doc["title"],
            source_url=doc["source_url"],
            source_type=doc["source_type"],
            text=doc["text"],
        )
    return SeedResult(ingested=len(CORPUS), removed_legacy=removed)


async def _main() -> None:
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await seed(db)
    print(
        f"Seeded {result.ingested} knowledge documents; "
        f"removed {result.removed_legacy} legacy lesson duplicates."
    )


if __name__ == "__main__":
    asyncio.run(_main())
