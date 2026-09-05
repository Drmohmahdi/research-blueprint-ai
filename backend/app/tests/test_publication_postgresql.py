"""
Publication Intelligence — real PostgreSQL 16 persistence & concurrency closure gate.

Runs only against a real PostgreSQL DATABASE_URL (POSTGRES_TESTING=true). Uses
threading.Barrier + the FastAPI TestClient so each concurrent call gets its own
pooled connection (see app/db.py: get_db() opens a fresh SessionLocal per call),
producing genuine multi-connection races rather than single-session simulation.
"""
import threading

import pytest

from app import models
from app.db import engine
from app.tests.test_publication_intelligence import (
    client, create_manuscript_version, stamp,
)

pytestmark = pytest.mark.skipif(engine.dialect.name != "postgresql", reason="PostgreSQL-only publication closure gate")


def make_ready_version_with_journal(d, extra_author=None):
    """Create a version, mark it fully READY, seed a journal, and shortlist it."""
    v = create_manuscript_version(d)
    version_row = d.db.get(models.PublicationManuscriptVersion, v["id"])
    version_row.declarations_json = {"conflict_of_interest": "none", "funding": "none",
                                      "ai_disclosure": "none", "data_availability": "yes"}
    d.db.commit()
    for key in ["TITLE", "ABSTRACT", "KEYWORDS", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION", "REFERENCES", "DECLARATIONS"]:
        client.patch(f"/api/publication-intelligence/assets/{d.asset.id}/versions/{v['id']}/sections/{key}",
                     json={"status": "READY", "content": {}}, headers=d.owner_h)
    j = client.post("/api/publication-intelligence/journals", json={
        "title": f"Journal {v['id']}", "publisher": "P",
        "metadata": {"article_types": ["ORIGINAL_RESEARCH"]},
        "provider_name": "TEST_PROVIDER", "retrieved_at": stamp(), "stale_after": "2030-01-01T00:00:00Z",
    }, headers=d.admin_h)
    jid = j.json()["id"]
    client.put(f"/api/publication-intelligence/assets/{d.asset.id}/shortlist",
               json={"journal_id": jid, "position": "PRIMARY"}, headers=d.owner_h)
    return v, jid


# ── Migration / schema smoke (already verified via `alembic upgrade head` +
#    `\d` inspection in the closure session; this just proves the app's own
#    engine, bound to DATABASE_URL, agrees) ───────────────────────────────────

def test_pg_dialect_is_active():
    assert engine.dialect.name == "postgresql"


# ── Persistence: version immutability + fingerprint ──────────────────────────

def test_pg_version_history_immutable_and_fingerprinted(domain):
    d = domain
    v1 = create_manuscript_version(d)
    v2 = create_manuscript_version(d)
    v3 = create_manuscript_version(d)
    assert [v1["version_number"], v2["version_number"], v3["version_number"]] == [1, 2, 3]
    fps = {v1["fingerprint"], v2["fingerprint"], v3["fingerprint"]}
    assert len(fps) == 3 and all(len(f) == 64 for f in fps)
    d.db.expire_all()
    row1 = d.db.get(models.PublicationManuscriptVersion, v1["id"])
    assert row1.fingerprint == v1["fingerprint"] and row1.version_number == 1


# ── Persistence: authorship fields round-trip exactly ─────────────────────────

def test_pg_authorship_fields_persist(domain):
    d = domain
    v = create_manuscript_version(d)
    r = client.post(f"/api/publication-intelligence/assets/{d.asset.id}/versions/{v['id']}/authorship", json={
        "user_id": d.coauthor.id, "display_name": "د. مؤلف", "affiliation": "جامعة الملك سعود",
        "orcid": "0000-0002-1825-0097", "author_order": 2, "is_corresponding_author": False,
        "credit_roles": ["Methodology", "Writing – Original Draft"],
    }, headers=d.owner_h)
    assert r.status_code == 201, r.text
    d.db.expire_all()
    row = d.db.get(models.PublicationManuscriptAuthorship, r.json()["id"])
    assert row.display_name == "د. مؤلف" and row.affiliation == "جامعة الملك سعود"
    assert row.orcid == "0000-0002-1825-0097" and row.author_order == 2
    assert row.credit_roles == ["Methodology", "Writing – Original Draft"]
    assert row.confirmed_at is None and row.is_corresponding_author is False


# ── Transaction rollback: a blocked version create leaves zero partial rows ──

def test_pg_rollback_leaves_no_partial_manuscript_state(domain):
    d = domain
    d.analysis.status = "UNDER_REVIEW"; d.analysis.approved_at = None; d.db.commit()
    before = d.db.query(models.PublicationManuscriptVersion).filter(
        models.PublicationManuscriptVersion.asset_id == d.asset.id).count()
    r = client.post(f"/api/publication-intelligence/assets/{d.asset.id}/versions", json={
        "article_type": "ORIGINAL_RESEARCH", "change_summary": "v",
        "dependencies": [{"type": "ANALYSIS", "id": d.analysis.id}],
    }, headers=d.owner_h)
    assert r.status_code == 409
    after_versions = d.db.query(models.PublicationManuscriptVersion).filter(
        models.PublicationManuscriptVersion.asset_id == d.asset.id).count()
    after_sections = d.db.query(models.PublicationManuscriptSection).join(
        models.PublicationManuscriptVersion,
        models.PublicationManuscriptSection.manuscript_version_id == models.PublicationManuscriptVersion.id
    ).filter(models.PublicationManuscriptVersion.asset_id == d.asset.id).count()
    assert after_versions == before
    assert after_sections == before * 10  # 10 sections per version, none orphaned


# ── Concurrency 1: manuscript version allocation race ─────────────────────────

def test_pg_concurrent_version_creation_allocates_distinct_numbers(domain):
    d = domain
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker():
        try:
            barrier.wait(timeout=5)
            r = client.post(f"/api/publication-intelligence/assets/{d.asset.id}/versions", json={
                "article_type": "ORIGINAL_RESEARCH", "change_summary": "concurrent", "dependencies": [],
            }, headers=d.owner_h)
            results.append((r.status_code, r.json() if r.status_code == 201 else r.text))
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    assert all(code == 201 for code, _ in results), f"a request failed instead of allocating cleanly: {results}"
    numbers = sorted(body["version_number"] for _, body in results)
    assert numbers == [1, 2], f"expected distinct sequential numbers, got {numbers}"
    db_count = d.db.query(models.PublicationManuscriptVersion).filter(
        models.PublicationManuscriptVersion.asset_id == d.asset.id).count()
    assert db_count == 2


# ── Concurrency 2: corresponding-author reassignment race (exactly 2 authors,
#    the case most likely to deadlock under naive "clear others" locking) ─────

def test_pg_concurrent_corresponding_author_reassignment_is_safe(domain):
    d = domain
    v = create_manuscript_version(d)
    a1 = client.post(f"/api/publication-intelligence/assets/{d.asset.id}/versions/{v['id']}/authorship",
                     json={"user_id": d.owner.id, "author_order": 1, "is_corresponding_author": True, "credit_roles": []},
                     headers=d.owner_h).json()
    a2 = client.post(f"/api/publication-intelligence/assets/{d.asset.id}/versions/{v['id']}/authorship",
                     json={"user_id": d.coauthor.id, "author_order": 2, "is_corresponding_author": False, "credit_roles": []},
                     headers=d.owner_h).json()

    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker(authorship_id):
        try:
            barrier.wait(timeout=5)
            r = client.patch(
                f"/api/publication-intelligence/assets/{d.asset.id}/versions/{v['id']}/authorship/{authorship_id}",
                json={"is_corresponding_author": True}, headers=d.owner_h)
            results.append(r.status_code)
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(aid,)) for aid in (a1["id"], a2["id"])]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions (possible undetected deadlock): {errors}"
    assert all(code == 200 for code in results), f"a request failed instead of resolving cleanly: {results}"
    d.db.expire_all()
    rows = d.db.query(models.PublicationManuscriptAuthorship).filter(
        models.PublicationManuscriptAuthorship.manuscript_version_id == v["id"]).all()
    correspondents = [r.id for r in rows if r.is_corresponding_author]
    assert len(correspondents) == 1, f"expected exactly one corresponding author, got {correspondents}"


# ── Concurrency 3: submission recording idempotency ────────────────────────────

def test_pg_concurrent_identical_submission_does_not_duplicate(domain):
    d = domain
    v, jid = make_ready_version_with_journal(d)
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker():
        try:
            barrier.wait(timeout=5)
            r = client.post(f"/api/publication-intelligence/assets/{d.asset.id}/submissions", json={
                "journal_id": jid, "manuscript_version_id": v["id"], "package_snapshot": {"files": ["f1"]},
            }, headers=d.owner_h)
            results.append((r.status_code, r.json() if r.status_code == 201 else r.text))
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    successes = [b for c, b in results if c == 201]
    conflicts = [b for c, b in results if c == 409]
    assert len(successes) == 1 and len(conflicts) == 1, f"expected one success + one 409 conflict, got {results}"
    db_count = d.db.query(models.PublicationSubmission).filter(
        models.PublicationSubmission.asset_id == d.asset.id,
        models.PublicationSubmission.manuscript_version_id == v["id"],
        models.PublicationSubmission.journal_id == jid).count()
    assert db_count == 1, "duplicate PublicationSubmission rows created for the same logical submission"


# ── Concurrency 4: submission state transition race (no dual final state) ─────

def test_pg_concurrent_conflicting_submission_transitions_yield_one_outcome(domain):
    d = domain
    v, jid = make_ready_version_with_journal(d)
    created = client.post(f"/api/publication-intelligence/assets/{d.asset.id}/submissions", json={
        "journal_id": jid, "manuscript_version_id": v["id"], "package_snapshot": {},
    }, headers=d.owner_h)
    sid = created.json()["id"]
    for target in ["READY_TO_SUBMIT", "SUBMITTED", "UNDER_REVIEW"]:
        r = client.patch(f"/api/publication-intelligence/assets/{d.asset.id}/submissions/{sid}/status",
                         json={"status": target}, headers=d.owner_h)
        assert r.status_code == 200, r.text

    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker(target):
        try:
            barrier.wait(timeout=5)
            r = client.patch(f"/api/publication-intelligence/assets/{d.asset.id}/submissions/{sid}/status",
                             json={"status": target}, headers=d.owner_h)
            results.append((target, r.status_code))
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(t,)) for t in ("ACCEPTED", "REJECTED")]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    oks = [t for t, c in results if c == 200]
    assert len(oks) == 1, f"expected exactly one transition to win, both/neither succeeded: {results}"
    d.db.expire_all()
    final = d.db.get(models.PublicationSubmission, sid)
    assert final.status == oks[0], f"final DB state {final.status!r} does not match the transition that reported success ({oks[0]!r}) — silent lost update"
    assert final.status in {"ACCEPTED", "REJECTED"}


# ── Concurrency 5: acceptance recording race (no duplicate acceptance rows) ───

def test_pg_concurrent_acceptance_recording_does_not_duplicate(domain):
    d = domain
    v, jid = make_ready_version_with_journal(d)
    created = client.post(f"/api/publication-intelligence/assets/{d.asset.id}/submissions", json={
        "journal_id": jid, "manuscript_version_id": v["id"], "package_snapshot": {},
    }, headers=d.owner_h)
    sid = created.json()["id"]
    for target in ["READY_TO_SUBMIT", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED"]:
        r = client.patch(f"/api/publication-intelligence/assets/{d.asset.id}/submissions/{sid}/status",
                         json={"status": target}, headers=d.owner_h)
        assert r.status_code == 200, r.text

    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker():
        try:
            barrier.wait(timeout=5)
            r = client.post(f"/api/publication-intelligence/assets/{d.asset.id}/acceptances", json={
                "submission_id": sid, "accepted_at": stamp(), "evidence": "letter.pdf",
            }, headers=d.owner_h)
            results.append((r.status_code, r.json() if r.status_code == 201 else r.text))
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    successes = [b for c, b in results if c == 201]
    conflicts = [b for c, b in results if c == 409]
    assert len(successes) == 1 and len(conflicts) == 1, f"expected one success + one 409 conflict, got {results}"
    db_count = d.db.query(models.PublicationAcceptance).filter(models.PublicationAcceptance.submission_id == sid).count()
    assert db_count == 1


# ── Concurrency 6: shortlist upsert race (same asset+journal pair) ────────────

def test_pg_concurrent_identical_shortlist_upsert_does_not_duplicate(domain):
    d = domain
    j = client.post("/api/publication-intelligence/journals", json={
        "title": f"Race Journal {d.suffix}", "publisher": "P",
        "metadata": {"article_types": ["ORIGINAL_RESEARCH"]},
        "provider_name": "TEST_PROVIDER", "retrieved_at": stamp(), "stale_after": "2030-01-01T00:00:00Z",
    }, headers=d.admin_h)
    jid = j.json()["id"]
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker():
        try:
            barrier.wait(timeout=5)
            r = client.put(f"/api/publication-intelligence/assets/{d.asset.id}/shortlist",
                           json={"journal_id": jid, "position": "PRIMARY"}, headers=d.owner_h)
            results.append(r.status_code)
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    assert all(code in (200, 201) for code in results), f"a request failed instead of upserting cleanly: {results}"
    db_count = d.db.query(models.PublicationJournalShortlist).filter(
        models.PublicationJournalShortlist.asset_id == d.asset.id,
        models.PublicationJournalShortlist.journal_id == jid).count()
    assert db_count == 1
