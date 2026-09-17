"""seed_curriculum

Revision ID: 80be607aeeb4
Revises: b2c3d4e5f6a7
Create Date: 2026-09-17 17:56:31.681224

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '80be607aeeb4'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Fixed UUIDs -- used in both upgrade() and downgrade() for deterministic ops
# ---------------------------------------------------------------------------

# Course
COURSE_ID = "a1000000-0000-4000-8000-000000000001"

# Modules
MODULE_QUBITS_ID    = "b1000000-0000-4000-8000-000000000001"
MODULE_ENTANGLE_ID  = "b1000000-0000-4000-8000-000000000002"

# Lessons
LESSON_SUPERPOS_ID  = "c1000000-0000-4000-8000-000000000001"
LESSON_HADAMARD_ID  = "c1000000-0000-4000-8000-000000000002"
LESSON_BELL_ID      = "c1000000-0000-4000-8000-000000000003"
LESSON_CIRCUITS_ID  = "c1000000-0000-4000-8000-000000000004"

# Concepts
CONCEPT_SUPERPOS_ID  = "d1000000-0000-4000-8000-000000000001"
CONCEPT_HADAMARD_ID  = "d1000000-0000-4000-8000-000000000002"
CONCEPT_ENTANGLE_ID  = "d1000000-0000-4000-8000-000000000003"
CONCEPT_BELL_ID      = "d1000000-0000-4000-8000-000000000004"


# ---------------------------------------------------------------------------
# Lightweight table constructs (no ORM imports)
# ---------------------------------------------------------------------------

courses_t = sa.table(
    "courses",
    sa.column("id",           postgresql.UUID(as_uuid=True)),
    sa.column("title",        sa.String),
    sa.column("description",  sa.Text),
    sa.column("difficulty",   sa.String),
    sa.column("is_published", sa.Boolean),
    sa.column("order_index",  sa.Integer),
)

modules_t = sa.table(
    "modules",
    sa.column("id",          postgresql.UUID(as_uuid=True)),
    sa.column("course_id",   postgresql.UUID(as_uuid=True)),
    sa.column("title",       sa.String),
    sa.column("description", sa.Text),
    sa.column("order_index", sa.Integer),
)

lessons_t = sa.table(
    "lessons",
    sa.column("id",          postgresql.UUID(as_uuid=True)),
    sa.column("module_id",   postgresql.UUID(as_uuid=True)),
    sa.column("title",       sa.String),
    sa.column("content",     sa.Text),
    sa.column("lesson_type", sa.String),
    sa.column("order_index", sa.Integer),
    sa.column("is_pro",      sa.Boolean),
)

concepts_t = sa.table(
    "concepts",
    sa.column("id",            postgresql.UUID(as_uuid=True)),
    sa.column("lesson_id",     postgresql.UUID(as_uuid=True)),
    sa.column("name",          sa.String),
    sa.column("description",   sa.Text),
    sa.column("prerequisites", sa.JSON),
)


# ---------------------------------------------------------------------------
# Lesson content -- real Markdown + KaTeX bodies
# ---------------------------------------------------------------------------

CONTENT_SUPERPOSITION = r"""# Superposition

A classical bit is either **0** or **1**. A qubit, by contrast, can exist in a
*superposition* of both states simultaneously, described by the state vector:

$$|\psi\rangle = \alpha|0\rangle + \beta|1\rangle$$

where $\alpha, \beta \in \mathbb{C}$ are *probability amplitudes* satisfying the
normalisation condition:

$$|\alpha|^2 + |\beta|^2 = 1$$

$|\alpha|^2$ is the probability of measuring $|0\rangle$ and $|\beta|^2$ is the
probability of measuring $|1\rangle$. Once we measure the qubit, it *collapses*
to one of those two basis states -- the superposition is destroyed.

## Bloch Sphere

We can visualise a single-qubit pure state as a point on the **Bloch sphere**:

$$|\psi\rangle = \cos\!\left(\frac{\theta}{2}\right)|0\rangle + e^{i\phi}\sin\!\left(\frac{\theta}{2}\right)|1\rangle$$

where $\theta \in [0,\pi]$ is the polar angle and $\phi \in [0,2\pi)$ is the
azimuthal angle. The north pole corresponds to $|0\rangle$ and the south pole
to $|1\rangle$.

## Key Insight

> Quantum parallelism -- the ability to act on all basis states at once -- stems
> directly from superposition. A register of $n$ qubits can represent
> $2^n$ classical states simultaneously.
"""

CONTENT_HADAMARD = r"""# The Hadamard Gate

The **Hadamard gate** $H$ is the most fundamental single-qubit gate. It creates
an *equal superposition* from either computational basis state:

$$H|0\rangle = \frac{|0\rangle + |1\rangle}{\sqrt{2}} \equiv |{+}\rangle$$

$$H|1\rangle = \frac{|0\rangle - |1\rangle}{\sqrt{2}} \equiv |{-}\rangle$$

## Matrix Representation

$$H = \frac{1}{\sqrt{2}}\begin{pmatrix}1 & 1\\1 & -1\end{pmatrix}$$

Note that $H = H^\dagger$ (Hermitian) and $H^2 = I$ (self-inverse), so applying
$H$ twice returns the qubit to its original state.

## Circuit Notation

In circuit diagrams $H$ is drawn as a box labelled **H**:

```
|0> --- H --- (measurement)
```

Applying $H$ to $|0\rangle$ then measuring gives **0** or **1** with equal
probability $\tfrac{1}{2}$ -- a perfect quantum coin flip.

## Why It Matters

The Hadamard gate is the entry point to most quantum algorithms:
- **Grover's search** -- builds the equal superposition starting state.
- **Quantum Fourier Transform** -- $H$ is the 1-qubit QFT.
- **Bell state preparation** -- $H$ followed by CNOT creates entanglement.
"""

CONTENT_BELL = r"""# Bell States and Entanglement

**Entanglement** is a non-classical correlation between qubits: measuring one
qubit *instantly* determines the state of its entangled partner, regardless of
distance.

## Preparing the Bell State $|\Phi^+\rangle$

Start with two qubits in $|00\rangle$ and apply:
1. Hadamard $H$ to qubit 0.
2. CNOT with qubit 0 as control, qubit 1 as target.

$$|\Phi^+\rangle = \frac{|00\rangle + |11\rangle}{\sqrt{2}}$$

The circuit is:

```circuit
{
  "qubits": 2,
  "gates": [
    {"type": "H",    "targets": [0]},
    {"type": "CNOT", "control": 0, "targets": [1]}
  ]
}
```

## The Four Bell States

$$|\Phi^{\pm}\rangle = \frac{|00\rangle \pm |11\rangle}{\sqrt{2}}, \quad
  |\Psi^{\pm}\rangle = \frac{|01\rangle \pm |10\rangle}{\sqrt{2}}$$

These form a maximally entangled orthonormal basis for the two-qubit Hilbert
space $\mathcal{H} = \mathbb{C}^2 \otimes \mathbb{C}^2$.

## Why Entanglement Is Powerful

When you measure qubit 0 of $|\Phi^+\rangle$:
- If you get **0**, qubit 1 *collapses* to $|0\rangle$.
- If you get **1**, qubit 1 *collapses* to $|1\rangle$.

This perfect correlation underpins **quantum teleportation**, **superdense
coding**, and **quantum key distribution (QKD)**.
"""

CONTENT_CIRCUITS = r"""# Quantum Circuit Basics

A **quantum circuit** is a model for quantum computation: qubits are the
*wires*, and quantum gates are the *operations* applied along those wires,
read left-to-right in time order.

## Single-Qubit Gates

| Gate | Matrix | Effect on $|0\rangle$ |
|------|--------|-----------------------|
| $I$  | $\begin{pmatrix}1&0\\0&1\end{pmatrix}$ | $|0\rangle$ |
| $X$  | $\begin{pmatrix}0&1\\1&0\end{pmatrix}$ | $|1\rangle$ |
| $H$  | $\tfrac{1}{\sqrt2}\begin{pmatrix}1&1\\1&-1\end{pmatrix}$ | $|{+}\rangle$ |
| $Z$  | $\begin{pmatrix}1&0\\0&-1\end{pmatrix}$ | $|0\rangle$ |

## Two-Qubit Gate: CNOT

The **Controlled-NOT** flips the target qubit *if and only if* the control
qubit is $|1\rangle$:

$$\text{CNOT} = \begin{pmatrix}1&0&0&0\\0&1&0&0\\0&0&0&1\\0&0&1&0\end{pmatrix}$$

## Example: 2-Qubit Circuit

```circuit
{
  "qubits": 2,
  "gates": [
    {"type": "X",    "targets": [0]},
    {"type": "H",    "targets": [1]},
    {"type": "CNOT", "control": 1, "targets": [0]}
  ]
}
```

Starting from $|00\rangle$:
1. $X$ on qubit 0 -> $|10\rangle$
2. $H$ on qubit 1 -> $\tfrac{1}{\sqrt2}(|10\rangle + |11\rangle)$
3. CNOT -> $\tfrac{1}{\sqrt2}(|10\rangle + |01\rangle) = |\Psi^-\rangle$ (up to global phase)

## Measurement

Placing a meter symbol $\mathcal{M}$ on a qubit collapses it to $|0\rangle$ or
$|1\rangle$ with probabilities $|\alpha|^2$ and $|\beta|^2$ respectively.
"""


# ---------------------------------------------------------------------------
# Upgrade / Downgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    # NOTE: This is a one-shot forward seed. Re-running will fail with a
    # UniqueViolation on concepts.name (UNIQUE constraint). To re-seed, run
    # `alembic downgrade b2c3d4e5f6a7` first, then `alembic upgrade head`.

    # 1. Course
    op.bulk_insert(courses_t, [
        {
            "id":           uuid.UUID(COURSE_ID),
            "title":        "Quantum Foundations",
            "description":  (
                "A ground-up introduction to quantum computing: from the qubit and "
                "superposition, through single-qubit gates, to entanglement and "
                "Bell states. No prior quantum knowledge required."
            ),
            "difficulty":   "beginner",
            "is_published": True,
            "order_index":  0,
        }
    ])

    # 2. Modules
    op.bulk_insert(modules_t, [
        {
            "id":          uuid.UUID(MODULE_QUBITS_ID),
            "course_id":   uuid.UUID(COURSE_ID),
            "title":       "Qubits & Superposition",
            "description": "Understand what a qubit is, how superposition works, and how single-qubit gates manipulate quantum state.",
            "order_index": 0,
        },
        {
            "id":          uuid.UUID(MODULE_ENTANGLE_ID),
            "course_id":   uuid.UUID(COURSE_ID),
            "title":       "Entanglement & Bell States",
            "description": "Explore two-qubit systems, entanglement, and the four Bell states that power quantum communication protocols.",
            "order_index": 1,
        },
    ])

    # 3. Lessons
    op.bulk_insert(lessons_t, [
        {
            "id":          uuid.UUID(LESSON_SUPERPOS_ID),
            "module_id":   uuid.UUID(MODULE_QUBITS_ID),
            "title":       "Superposition",
            "content":     CONTENT_SUPERPOSITION,
            "lesson_type": "text",
            "order_index": 0,
            "is_pro":      False,
        },
        {
            "id":          uuid.UUID(LESSON_HADAMARD_ID),
            "module_id":   uuid.UUID(MODULE_QUBITS_ID),
            "title":       "The Hadamard Gate",
            "content":     CONTENT_HADAMARD,
            "lesson_type": "text",
            "order_index": 1,
            "is_pro":      False,
        },
        {
            "id":          uuid.UUID(LESSON_BELL_ID),
            "module_id":   uuid.UUID(MODULE_ENTANGLE_ID),
            "title":       "Bell States & Entanglement",
            "content":     CONTENT_BELL,
            "lesson_type": "text",
            "order_index": 0,
            "is_pro":      False,
        },
        {
            "id":          uuid.UUID(LESSON_CIRCUITS_ID),
            "module_id":   uuid.UUID(MODULE_ENTANGLE_ID),
            "title":       "Quantum Circuit Basics",
            "content":     CONTENT_CIRCUITS,
            "lesson_type": "text",
            "order_index": 1,
            "is_pro":      False,
        },
    ])

    # 4. Concepts (FK-safe: lessons already inserted above)
    # Use op.execute with sa.text() so JSON literals render correctly in --sql mode.
    op.execute(sa.text(
        "INSERT INTO concepts (id, lesson_id, name, description, prerequisites) VALUES"
        " (CAST(:id1 AS uuid), CAST(:lid1 AS uuid), :n1, :d1, CAST(:p1 AS json)),"
        " (CAST(:id2 AS uuid), CAST(:lid2 AS uuid), :n2, :d2, CAST(:p2 AS json)),"
        " (CAST(:id3 AS uuid), CAST(:lid3 AS uuid), :n3, :d3, CAST(:p3 AS json)),"
        " (CAST(:id4 AS uuid), CAST(:lid4 AS uuid), :n4, :d4, CAST(:p4 AS json))"
    ).bindparams(
        id1=CONCEPT_SUPERPOS_ID,  lid1=LESSON_SUPERPOS_ID,
        n1="superposition",
        d1="A qubit exists in a linear combination a|0>+b|1> until measured; |a|^2+|b|^2=1.",
        p1="[]",
        id2=CONCEPT_HADAMARD_ID,  lid2=LESSON_HADAMARD_ID,
        n2="hadamard_gate",
        d2="H = (1/sqrt(2))[[1,1],[1,-1]]; maps |0>->|+> and |1>->|->; self-inverse.",
        p2='["superposition"]',
        id3=CONCEPT_ENTANGLE_ID,  lid3=LESSON_BELL_ID,
        n3="entanglement",
        d3="Non-separable multi-qubit state where measurement of one qubit instantly determines the other.",
        p3='["superposition", "hadamard_gate"]',
        id4=CONCEPT_BELL_ID,      lid4=LESSON_BELL_ID,
        n4="bell_state",
        d4="Maximally entangled two-qubit states; prepared via H + CNOT from |00>.",
        p4='["entanglement", "hadamard_gate"]',
    ))


def downgrade() -> None:
    # Delete in FK-safe reverse order: concepts -> lessons -> modules -> courses
    concept_ids = [
        uuid.UUID(CONCEPT_BELL_ID),
        uuid.UUID(CONCEPT_ENTANGLE_ID),
        uuid.UUID(CONCEPT_HADAMARD_ID),
        uuid.UUID(CONCEPT_SUPERPOS_ID),
    ]
    lesson_ids = [
        uuid.UUID(LESSON_CIRCUITS_ID),
        uuid.UUID(LESSON_BELL_ID),
        uuid.UUID(LESSON_HADAMARD_ID),
        uuid.UUID(LESSON_SUPERPOS_ID),
    ]
    module_ids = [
        uuid.UUID(MODULE_ENTANGLE_ID),
        uuid.UUID(MODULE_QUBITS_ID),
    ]

    op.execute(
        concepts_t.delete().where(
            concepts_t.c.id.in_(concept_ids)
        )
    )
    op.execute(
        lessons_t.delete().where(
            lessons_t.c.id.in_(lesson_ids)
        )
    )
    op.execute(
        modules_t.delete().where(
            modules_t.c.id.in_(module_ids)
        )
    )
    op.execute(
        courses_t.delete().where(
            courses_t.c.id == uuid.UUID(COURSE_ID)
        )
    )
