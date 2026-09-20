"""Seed the RAG knowledge base with a curated quantum-computing corpus.

Run once against a database with the knowledge tables + pgvector:

    python -m scripts.seed_knowledge

The corpus reuses the Slice 2a lesson bodies (Markdown + KaTeX) plus a few
trimmed Qiskit-documentation excerpts, each carrying a `source_url` so the tutor
can cite it. `all-MiniLM-L6-v2` downloads on first use.
"""
from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.rag.ingestion import ingest_document


# ---------------------------------------------------------------------------
# Curated corpus
# ---------------------------------------------------------------------------

_SUPERPOSITION = r"""# Superposition

A classical bit is either 0 or 1. A qubit, by contrast, can exist in a
superposition of both states simultaneously, described by the state vector
|psi> = alpha|0> + beta|1>, where alpha and beta are complex probability
amplitudes satisfying the normalisation condition |alpha|^2 + |beta|^2 = 1.

|alpha|^2 is the probability of measuring |0> and |beta|^2 is the probability of
measuring |1>. Once we measure the qubit, it collapses to one of those two basis
states and the superposition is destroyed.

A single-qubit pure state can be visualised as a point on the Bloch sphere. The
north pole corresponds to |0> and the south pole to |1>. Quantum parallelism,
the ability to act on all basis states at once, stems directly from
superposition: a register of n qubits can represent 2^n classical states
simultaneously.
"""

_HADAMARD = r"""# The Hadamard Gate

The Hadamard gate H is the most fundamental single-qubit gate. It creates an
equal superposition from either computational basis state:
H|0> = (|0> + |1>)/sqrt(2), written |+>, and H|1> = (|0> - |1>)/sqrt(2),
written |->.

Its matrix is (1/sqrt(2)) [[1, 1], [1, -1]]. The Hadamard gate is Hermitian
(H = H-dagger) and self-inverse (H^2 = I), so applying H twice returns the qubit
to its original state.

Applying H to |0> then measuring gives 0 or 1 with equal probability one half, a
perfect quantum coin flip. The Hadamard gate is the entry point to most quantum
algorithms: it builds the equal superposition starting state for Grover's
search, is the single-qubit Quantum Fourier Transform, and, followed by CNOT,
prepares an entangled Bell state.
"""

_ENTANGLEMENT = r"""# Bell States and Entanglement

Entanglement is a non-classical correlation between qubits: measuring one qubit
instantly determines the state of its entangled partner, regardless of distance.

To prepare the Bell state |Phi+> start with two qubits in |00> and apply a
Hadamard H to qubit 0, then a CNOT with qubit 0 as control and qubit 1 as
target. The result is |Phi+> = (|00> + |11>)/sqrt(2).

The four Bell states |Phi+->, |Psi+-> form a maximally entangled orthonormal
basis for the two-qubit Hilbert space. When you measure qubit 0 of |Phi+>, if
you get 0 the partner collapses to |0>, and if you get 1 the partner collapses
to |1>. This perfect correlation underpins quantum teleportation, superdense
coding, and quantum key distribution.
"""

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
        "title": "Superposition",
        "source_url": "https://qlearn.dev/lessons/superposition",
        "source_type": "course",
        "text": _SUPERPOSITION,
    },
    {
        "title": "The Hadamard Gate",
        "source_url": "https://qlearn.dev/lessons/hadamard",
        "source_type": "course",
        "text": _HADAMARD,
    },
    {
        "title": "Bell States & Entanglement",
        "source_url": "https://qlearn.dev/lessons/entanglement",
        "source_type": "course",
        "text": _ENTANGLEMENT,
    },
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


async def seed(db: AsyncSession) -> int:
    """Ingest every corpus document. Returns the number of documents ingested."""
    for doc in CORPUS:
        await ingest_document(
            db,
            title=doc["title"],
            source_url=doc["source_url"],
            source_type=doc["source_type"],
            text=doc["text"],
        )
    return len(CORPUS)


async def _main() -> None:
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        count = await seed(db)
    print(f"Seeded {count} knowledge documents.")


if __name__ == "__main__":
    asyncio.run(_main())
