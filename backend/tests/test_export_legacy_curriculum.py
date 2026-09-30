"""Tests for the legacy curriculum export script (hermetic, mocked session)."""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from scripts import export_legacy_curriculum


async def test_export_preserves_lesson_ids_and_hierarchy():
    lesson = SimpleNamespace(
        id=uuid.uuid4(), title="Qubits", content="# Qubits", lesson_type="text",
        is_pro=False, order_index=0,
    )
    module = SimpleNamespace(
        id=uuid.uuid4(), title="Basics", description=None, order_index=0, lessons=[lesson],
    )
    course = SimpleNamespace(
        id=uuid.uuid4(), title="Intro", description="d", difficulty="beginner",
        order_index=0, modules=[module],
    )
    result = MagicMock()
    result.scalars.return_value.all.return_value = [course]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    data = await export_legacy_curriculum.export(db)

    assert data["version"] == 1
    exported_lesson = data["courses"][0]["modules"][0]["lessons"][0]
    assert exported_lesson["id"] == str(lesson.id)
    assert exported_lesson["content"] == "# Qubits"
    assert data["courses"][0]["modules"][0]["title"] == "Basics"
