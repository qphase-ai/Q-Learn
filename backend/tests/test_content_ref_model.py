"""Hermetic tests for the content_refs boundary model and migration graph."""
import uuid
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _fk_targets(column) -> dict[str, str | None]:
    return {fk.target_fullname: fk.ondelete for fk in column.foreign_keys}


def test_content_ref_table_shape():
    from app.models.content_ref import ContentRef

    table = ContentRef.__table__
    assert table.name == "content_refs"
    assert set(table.c.keys()) == {"id", "payload_id", "kind", "created_at"}
    assert table.c.payload_id.nullable is False
    assert table.c.kind.nullable is False
    constraint_names = {c.name for c in table.constraints}
    assert "uq_content_refs_kind_payload_id" in constraint_names
    assert "ck_content_refs_kind" in constraint_names


def test_content_kind_values_match_spec():
    from app.models.content_ref import ContentKind

    assert {k.value for k in ContentKind} == {"curriculum", "level", "module", "lesson"}


def test_is_legacy_reflects_sentinel_prefix():
    from app.models.content_ref import ContentRef, LEGACY_PAYLOAD_PREFIX

    ref_id = uuid.uuid4()
    legacy = ContentRef(id=ref_id, kind="lesson", payload_id=f"{LEGACY_PAYLOAD_PREFIX}{ref_id}")
    bound = ContentRef(id=ref_id, kind="lesson", payload_id="42")
    assert legacy.is_legacy is True
    assert bound.is_legacy is False


def test_progress_lesson_fk_targets_content_refs():
    from app.models.progress import LearningProgress

    assert _fk_targets(LearningProgress.__table__.c.lesson_id) == {"content_refs.id": "CASCADE"}


def test_quiz_question_lesson_fk_targets_content_refs():
    from app.models.assessment import QuizQuestion

    assert _fk_targets(QuizQuestion.__table__.c.lesson_id) == {"content_refs.id": "SET NULL"}


def test_skill_mastery_still_targets_concepts():
    from app.models.progress import SkillMastery

    assert set(_fk_targets(SkillMastery.__table__.c.concept_id)) == {"concepts.id"}


def test_content_refs_migration_is_single_head():
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    script = ScriptDirectory.from_config(cfg)
    assert "d4e5f6a7b8c9" in {r.revision for r in script.walk_revisions()}
    assert len(script.get_heads()) == 1
    assert script.get_revision("d4e5f6a7b8c9").down_revision == "c3d4e5f6a7b8"
