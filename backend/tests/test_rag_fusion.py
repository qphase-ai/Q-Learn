"""Tests for Reciprocal Rank Fusion — pure function, no DB."""
import uuid

from app.rag.retrieval import rrf_fuse

A, B, C, D = (uuid.uuid4() for _ in range(4))


def _ids(fused):
    return [cid for cid, _ in fused]


def test_item_high_in_both_lists_beats_item_first_in_only_one():
    # B is 2nd in both lists; A is 1st in dense only, C is 1st in sparse only.
    fused = rrf_fuse([[A, B, D], [C, B]])
    assert _ids(fused)[0] == B
    assert set(_ids(fused)) == {A, B, C, D}


def test_scores_are_reciprocal_ranks_summed():
    fused = dict(rrf_fuse([[A, B], [B]], k=60))
    assert fused[A] == 1 / 61
    assert fused[B] == 1 / 62 + 1 / 61


def test_boost_reorders_results():
    assert _ids(rrf_fuse([[A, B]]))[0] == A
    assert _ids(rrf_fuse([[A, B]], boosts={B: 1.5}))[0] == B


def test_boost_for_unranked_id_is_ignored():
    assert _ids(rrf_fuse([[A]], boosts={C: 1.5})) == [A]


def test_empty_input_returns_empty():
    assert rrf_fuse([]) == []
    assert rrf_fuse([[], []]) == []
