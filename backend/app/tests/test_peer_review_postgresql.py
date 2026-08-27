"""
Peer Review & Editorial Intelligence — real PostgreSQL 16 concurrency closure gate.

Runs only against a real PostgreSQL DATABASE_URL (POSTGRES_TESTING=true). Uses
threading.Barrier + the FastAPI TestClient so each concurrent call gets its own
pooled connection (see app/db.py: get_db() opens a fresh SessionLocal per call),
producing genuine multi-connection races rather than single-session simulation.
"""
import threading

import pytest

from app import models
from app.db import engine, SessionLocal
from app.tests.test_peer_reviews import client, create_test_tenant, get_auth_headers

pytestmark = pytest.mark.skipif(engine.dialect.name != "postgresql", reason="PostgreSQL-only peer review closure gate")


@pytest.fixture
def pg_tenants():
    import secrets
    db = SessionLocal()
    suffix = secrets.token_hex(4)
    org_id = f"org-pr-pg-{suffix}"
    owner, org = create_test_tenant(db, f"pg_owner_{suffix}", org_id, role="OWNER")
    reviewer1, _ = create_test_tenant(db, f"pg_rev1_{suffix}", org_id, role="RESEARCHER")
    reviewer2, _ = create_test_tenant(db, f"pg_rev2_{suffix}", org_id, role="RESEARCHER")
    data = {
        "org_id": org_id,
        "owner_headers": get_auth_headers(owner.username, org_id),
        "reviewer1_id": reviewer1.id,
        "reviewer1_headers": get_auth_headers(reviewer1.username, org_id),
        "reviewer2_id": reviewer2.id,
    }
    yield data
    db.close()


def create_case(headers, title="PG Concurrency Case"):
    r = client.post("/api/peer-reviews/cases", headers=headers, json={"title_ar": title, "title_en": title})
    assert r.status_code == 201, r.text
    return r.json()


def test_pg_reviewer_invitation_race_no_duplicate(pg_tenants):
    case = create_case(pg_tenants["owner_headers"])
    round_id = case["rounds"][0]["id"]
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker():
        try:
            barrier.wait(timeout=5)
            r = client.post(
                f"/api/peer-reviews/rounds/{round_id}/assignments",
                headers=pg_tenants["owner_headers"],
                json={"reviewer_type": "INTERNAL_REVIEWER", "reviewer_user_id": pg_tenants["reviewer1_id"]},
            )
            results.append(r.status_code)
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    assert sorted(results) == [201, 409], f"expected one success + one 409 conflict, got {results}"
    with SessionLocal() as db:
        count = db.query(models.ReviewerAssignment).filter(
            models.ReviewerAssignment.round_id == round_id,
            models.ReviewerAssignment.reviewer_user_id == pg_tenants["reviewer1_id"],
        ).count()
    assert count == 1, "duplicate reviewer assignment rows created under concurrency"


def test_pg_round_creation_race_allocates_distinct_numbers(pg_tenants):
    case = create_case(pg_tenants["owner_headers"])
    case_id = case["id"]
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker():
        try:
            barrier.wait(timeout=5)
            r = client.post(f"/api/peer-reviews/cases/{case_id}/rounds", headers=pg_tenants["owner_headers"])
            results.append((r.status_code, r.json() if r.status_code == 201 else r.text))
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    assert all(code == 201 for code, _ in results), f"a request failed instead of allocating cleanly: {results}"
    numbers = sorted(body["round_number"] for _, body in results)
    assert numbers == [2, 3], f"expected distinct sequential round numbers, got {numbers}"
    with SessionLocal() as db:
        count = db.query(models.PeerReviewRound).filter(models.PeerReviewRound.case_id == case_id).count()
    assert count == 3  # round 1 (initial) + the two concurrently created


def test_pg_manuscript_revision_race_allocates_distinct_versions(pg_tenants):
    case = create_case(pg_tenants["owner_headers"])
    case_id = case["id"]
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker(label):
        try:
            barrier.wait(timeout=5)
            r = client.post(
                f"/api/peer-reviews/cases/{case_id}/revisions",
                headers=pg_tenants["owner_headers"],
                json={"title_ar": f"مراجعة {label}", "title_en": f"Revision {label}"},
            )
            results.append((r.status_code, r.json() if r.status_code == 201 else r.text))
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(label,)) for label in ("A", "B")]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    assert all(code == 201 for code, _ in results), f"a request failed instead of allocating cleanly: {results}"
    numbers = sorted(body["version_number"] for _, body in results)
    assert numbers == [2, 3], f"expected distinct sequential version numbers, got {numbers}"


def test_pg_conflicting_editorial_decisions_yield_one_authoritative_outcome(pg_tenants):
    case = create_case(pg_tenants["owner_headers"])
    case_id = case["id"]
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker(decision):
        try:
            barrier.wait(timeout=5)
            r = client.post(
                f"/api/peer-reviews/cases/{case_id}/decision",
                headers=pg_tenants["owner_headers"],
                json={"decision": decision, "decision_notes": f"قرار متزامن {decision}"},
            )
            results.append((decision, r.status_code))
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(d,)) for d in ("ACCEPTED", "REJECTED")]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    oks = [d for d, c in results if c == 200]
    conflicts = [d for d, c in results if c == 409]
    assert len(oks) == 1 and len(conflicts) == 1, f"expected exactly one decision to win and the other to be rejected as already-decided, got {results}"
    with SessionLocal() as db:
        final_case = db.get(models.PeerReviewCase, case_id)
        final_round = db.query(models.PeerReviewRound).filter(
            models.PeerReviewRound.case_id == case_id,
            models.PeerReviewRound.round_number == final_case.current_round_number,
        ).first()
    # The winning decision is authoritative and matches the DB — no torn or
    # contradictory final state between the two racing transitions.
    assert final_round.decision == oks[0]
    assert final_round.status == "COMPLETED"


def test_pg_draft_after_submit_race_does_not_corrupt_state(pg_tenants):
    case = create_case(pg_tenants["owner_headers"])
    round_id = case["rounds"][0]["id"]
    r_assign = client.post(
        f"/api/peer-reviews/rounds/{round_id}/assignments",
        headers=pg_tenants["owner_headers"],
        json={"reviewer_type": "INTERNAL_REVIEWER", "reviewer_user_id": pg_tenants["reviewer1_id"]},
    )
    assignment_id = r_assign.json()["id"]
    reviewer_headers = pg_tenants["reviewer1_headers"]
    client.post(f"/api/peer-reviews/assignments/{assignment_id}/accept", headers=reviewer_headers, json={"conflict_status": "NO_CONFLICT"})

    criteria = case["rounds"][0]["rubric_snapshot_json"]["criteria"]
    responses = [{"criterion_id": c["id"], "score_value": 8.0} for c in criteria]

    barrier = threading.Barrier(2)
    results, errors = [], []

    def draft_worker():
        try:
            barrier.wait(timeout=5)
            r = client.put(
                f"/api/peer-reviews/assignments/{assignment_id}/draft",
                headers=reviewer_headers,
                json={"recommendation": "MAJOR_REVISION", "responses": [], "comments": []},
            )
            results.append(("draft", r.status_code))
        except Exception as exc:
            errors.append(exc)

    def submit_worker():
        try:
            barrier.wait(timeout=5)
            r = client.post(
                f"/api/peer-reviews/assignments/{assignment_id}/submit",
                headers=reviewer_headers,
                json={"recommendation": "ACCEPT", "responses": responses, "comments": []},
            )
            results.append(("submit", r.status_code))
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=draft_worker), threading.Thread(target=submit_worker)]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    # Both outcomes are order-dependent and acceptable individually, but the
    # persisted state must be self-consistent: never SUBMITTED status with a
    # DRAFT-only submission row, and never a submission carrying scored
    # responses while the assignment itself was left IN_PROGRESS.
    with SessionLocal() as db:
        assignment = db.get(models.ReviewerAssignment, assignment_id)
        submission = db.query(models.ReviewSubmission).filter(models.ReviewSubmission.assignment_id == assignment_id).first()
    if assignment.status == "SUBMITTED":
        assert submission.status == "SUBMITTED"
    else:
        assert submission.status == "DRAFT"
