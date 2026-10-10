"""Tests for the golden-set retrieval eval script (pure parts only, no DB)."""
from app.rag.retrieval import RetrievedChunk
from scripts import rag_eval
from scripts.rag_eval import GOLDEN, GoldenItem, ItemResult, query_text, report


def _chunk(title: str, score: float = 0.5) -> RetrievedChunk:
    return RetrievedChunk(content="x", title=title, source_url=None, chunk_index=0, score=score)


def test_golden_set_shape():
    assert 14 <= len(GOLDEN) <= 20
    kinds = {i.kind for i in GOLDEN}
    assert {"direct", "paraphrase", "follow-up", "out-of-scope"} <= kinds
    gating_oos = [i for i in GOLDEN if not i.expected and i.gating]
    assert len(gating_oos) >= 3
    assert any(i.prior_user_turn for i in GOLDEN)


def test_follow_up_query_is_built_like_the_tutor_builds_it():
    item = GoldenItem("why?", ("H",), prior_user_turn="what does the hadamard gate do")
    assert query_text(item) == "what does the hadamard gate do why?"
    assert query_text(GoldenItem("what is a qubit", ("Q",))) == "what is a qubit"


def test_hits_and_out_of_scope_rejection():
    item = GoldenItem("q", ("Hadamard",))
    second = ItemResult(item, [_chunk("Other"), _chunk("Hadamard")], 0.4)
    assert not second.hit_at_1 and second.hit_at_k and second.passed
    assert not ItemResult(item, [], 0.1).passed

    oos = GoldenItem("bread?", ())
    assert ItemResult(oos, [], 0.1).passed
    assert ItemResult(oos, [_chunk("Hadamard")], 0.1).failed


def test_report_fails_on_gating_items_only(capsys):
    in_scope = ItemResult(GoldenItem("q", ("H",)), [_chunk("H")], 0.5)
    near = ItemResult(GoldenItem("shor?", (), kind="near-domain", gating=False), [_chunk("M")], 0.3)
    leak = ItemResult(GoldenItem("bread?", (), kind="out-of-scope"), [_chunk("H")], 0.1)

    assert report([in_scope, near]) is True
    assert report([in_scope, near, leak]) is False
    out = capsys.readouterr().out
    assert "INFO" in out and "FAIL" in out
    assert "out-of-scope rejected 0/1" in out
    assert "near-domain rejected 0/1, not gating" in out


def test_main_is_exposed_for_python_dash_m():
    assert callable(rag_eval._main)
