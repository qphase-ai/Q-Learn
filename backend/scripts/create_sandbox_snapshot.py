"""Build the Qiskit-ready Vercel Sandbox snapshot that production restores per run.

`SandboxRunner` starts every sandbox with deny-all outbound network, so the
runtime must already contain qiskit + qiskit-aer. This script builds that
runtime once and prints the snapshot id to put in `SANDBOX_SNAPSHOT_ID`.

Run from `backend/` with the same credentials the API uses:

    export VERCEL_TOKEN=...        # team-scoped access token
    export VERCEL_TEAM_ID=team_...
    export VERCEL_PROJECT_ID=prj_...
    python -m scripts.create_sandbox_snapshot

Steps: start a sandbox with network access, `pip install` the packages, verify
the imports the simulation script needs, snapshot it with no expiration, then
restore the snapshot under the production network policy and re-check the
imports. Re-run it (and update `SANDBOX_SNAPSHOT_ID`) to upgrade Qiskit.
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import timedelta

from vercel import sandbox  # type: ignore[import-not-found]
from vercel.api import session  # type: ignore[import-not-found]
from vercel.sandbox import (  # type: ignore[import-not-found]
    NetworkPolicy,
    SandboxResources,
    SnapshotSource,
)

PACKAGES = ["qiskit", "qiskit-aer"]

# Mirrors the imports in the script QiskitAerAdapter renders.
IMPORT_CHECK = (
    "from qiskit import QuantumCircuit, transpile; "
    "from qiskit_aer import AerSimulator; "
    "from qiskit.quantum_info import Statevector; "
    "import qiskit, qiskit_aer; "
    "print('qiskit', qiskit.__version__, '| qiskit-aer', qiskit_aer.__version__)"
)

REQUIRED_ENV = ("VERCEL_TOKEN", "VERCEL_TEAM_ID", "VERCEL_PROJECT_ID")


async def _run(instance: object, args: list[str], step: str) -> str:
    proc = await instance.run_process("python", args, capture_output=True)  # type: ignore[attr-defined]
    stdout = proc.stdout or ""
    stderr = proc.stderr or ""
    if proc.returncode != 0:
        print(stdout[-4000:], stderr[-4000:], sep="\n", file=sys.stderr)
        raise SystemExit(f"{step} failed (exit {proc.returncode})")
    return stdout


async def main() -> None:
    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        raise SystemExit(f"Missing environment variables: {', '.join(missing)}")

    async with session():
        print("Building snapshot: installing", " ".join(PACKAGES), "...")
        async with sandbox.create_sandbox(
            resources=SandboxResources(vcpus=2, memory=4096),
            execution_time_limit=timedelta(minutes=15),
            # Egress is needed only here, for pip. Production runs deny-all.
            network_policy=NetworkPolicy.allow_all(),
        ) as builder:
            await _run(
                builder,
                ["-m", "pip", "install", "--no-cache-dir", *PACKAGES],
                "pip install",
            )
            print(await _run(builder, ["-c", IMPORT_CHECK], "import check").strip())
            # Zero disables expiration; an expiring snapshot would break
            # production silently once it lapses.
            snapshot = await builder.snapshot(expiration=0)
            snapshot_id = snapshot.id
            print("Snapshot created:", snapshot_id)

        print("Verifying snapshot under the production network policy ...")
        async with sandbox.create_sandbox(
            source=SnapshotSource(snapshot_id=snapshot_id),
            resources=SandboxResources(vcpus=1, memory=512),
            execution_time_limit=timedelta(minutes=2),
            network_policy=NetworkPolicy.deny_all(),
        ) as check:
            print(await _run(check, ["-c", IMPORT_CHECK], "snapshot verification").strip())

    print(f"\nSANDBOX_SNAPSHOT_ID={snapshot_id}")


if __name__ == "__main__":
    asyncio.run(main())
