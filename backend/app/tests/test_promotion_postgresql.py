"""
Academic Promotion Intelligence — real PostgreSQL 16 concurrency closure gate.

Runs only against a real PostgreSQL DATABASE_URL (POSTGRES_TESTING=true). Uses
threading.Barrier + the FastAPI TestClient so each concurrent call gets its own
pooled connection (see app/db.py: get_db() opens a fresh SessionLocal per call),
producing genuine multi-connection races rather than single-session simulation.

Committee decision authority is resource-scoped (PromotionCommitteeAssignment)
— these tests use explicitly assigned committee members, never a generic
OWNER/ORGANIZATION_ADMIN/SUPERVISOR role or platform-admin bypass, matching
the authority model enforced in promotions.py.
"""
import threading

import pytest

from app import models
from app.db import engine, SessionLocal
from app.tests.test_promotions import client, create_test_tenant, get_auth_headers, create_test_scholarly_asset

pytestmark = pytest.mark.skipif(engine.dialect.name != "postgresql", reason="PostgreSQL-only promotion closure gate")


@pytest.fixture
def pg_promotion():
    import secrets
    db = SessionLocal()
    suffix = secrets.token_hex(4)
    org_id = f"org-promo-pg-{suffix}"
    applicant, org = create_test_tenant(db, f"pg_appl_{suffix}", org_id, role="RESEARCHER")
    admin, _ = create_test_tenant(db, f"pg_admin_{suffix}", org_id, role="OWNER")
    committee_a, _ = create_test_tenant(db, f"pg_cma_{suffix}", org_id, role="RESEARCHER")
    committee_b, _ = create_test_tenant(db, f"pg_cmb_{suffix}", org_id, role="RESEARCHER")
    unassigned, _ = create_test_tenant(db, f"pg_unassigned_{suffix}", org_id, role="RESEARCHER")
    committee_a_id, committee_b_id = committee_a.id, committee_b.id
    asset_ids = []
    for i in range(2):
        asset_id = f"asset-pg-promo-{suffix}-{i}"
        create_test_scholarly_asset(db, applicant, org, asset_id, f"PG Concurrency Paper {i}", "Q1", "sole")
        asset_ids.append(asset_id)
    data = {
        "org_id": org_id,
        "applicant_headers": get_auth_headers(applicant.username, org_id),
        "admin_headers": get_auth_headers(admin.username, org_id),
        "committee_a_id": committee_a_id,
        "committee_a_headers": get_auth_headers(committee_a.username, org_id),
        "committee_b_id": committee_b_id,
        "committee_b_headers": get_auth_headers(committee_b.username, org_id),
        "unassigned_headers": get_auth_headers(unassigned.username, org_id),
        "asset_ids": asset_ids,
    }
    yield data
    db.close()


def create_application(headers):
    r = client.post("/api/promotions/applications", headers=headers, json={"target_rank": "ASSOCIATE_PROFESSOR"})
    assert r.status_code == 201, r.text
    return r.json()


def assign_committee(app_id, user_id, admin_headers):
    r = client.post(f"/api/promotions/applications/{app_id}/committee", headers=admin_headers, json={"user_id": user_id})
    assert r.status_code == 201, r.text
    return r.json()


def test_pg_evidence_mapping_race_no_duplicate_selection(pg_promotion):
    app = create_application(pg_promotion["applicant_headers"])
    app_id = app["id"]
    asset_id = pg_promotion["asset_ids"][0]
    headers = pg_promotion["applicant_headers"]
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker():
        try:
            barrier.wait(timeout=5)
            r = client.post(
                f"/api/promotions/applications/{app_id}/evidence",
                headers=headers,
                json={"scholarly_asset_ids": [asset_id]},
            )
            results.append(r.status_code)
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    # Both concurrent add-evidence calls for the SAME asset must resolve
    # cleanly (200, the endpoint is idempotent-by-design at the app level and
    # now backed by a real unique constraint under true concurrency) — never
    # an unhandled 500, and never two selection rows for the same asset.
    assert all(code == 200 for code in results), f"a request failed instead of resolving idempotently: {results}"
    with SessionLocal() as db:
        count = db.query(models.PromotionAssetSelection).filter(
            models.PromotionAssetSelection.promotion_application_id == app_id,
            models.PromotionAssetSelection.scholarly_asset_id == asset_id,
        ).count()
    assert count == 1, "duplicate promotion evidence selection rows created under concurrency"


def test_pg_evidence_mapping_race_distinct_assets_both_succeed(pg_promotion):
    """Sanity check that the row lock added for the race above does not
    over-serialize unrelated evidence (two DIFFERENT assets added concurrently
    to the same application must both land, not lose one to the lock)."""
    app = create_application(pg_promotion["applicant_headers"])
    app_id = app["id"]
    headers = pg_promotion["applicant_headers"]
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker(asset_id):
        try:
            barrier.wait(timeout=5)
            r = client.post(
                f"/api/promotions/applications/{app_id}/evidence",
                headers=headers,
                json={"scholarly_asset_ids": [asset_id]},
            )
            results.append(r.status_code)
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(aid,)) for aid in pg_promotion["asset_ids"]]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    assert all(code == 200 for code in results), f"a request failed under an unrelated-asset race: {results}"
    with SessionLocal() as db:
        count = db.query(models.PromotionAssetSelection).filter(
            models.PromotionAssetSelection.promotion_application_id == app_id,
        ).count()
    assert count == 2, "both distinct evidence assets should have been persisted"


def test_pg_double_submit_race_yields_one_notification_event(pg_promotion):
    app = create_application(pg_promotion["applicant_headers"])
    app_id = app["id"]
    headers = pg_promotion["applicant_headers"]
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker():
        try:
            barrier.wait(timeout=5)
            r = client.post(f"/api/promotions/applications/{app_id}/submit", headers=headers)
            results.append(r.status_code)
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    # Exactly one submit call may transition DRAFT -> SUBMITTED; the second,
    # racing call must observe the now-terminal state and be rejected, not
    # silently fire a second duplicate submission event.
    assert sorted(results) == [200, 409], f"expected one success + one 409 conflict, got {results}"
    with SessionLocal() as db:
        final_app = db.get(models.PromotionApplication, app_id)
        assert final_app.status == "SUBMITTED"
        event_count = db.query(models.WorkflowEvent).filter(
            models.WorkflowEvent.aggregate_id == app_id,
            models.WorkflowEvent.event_type == "PROMOTION_APPLICATION_SUBMITTED",
        ).count()
    assert event_count == 1, "double submit under a race produced more than one notification event"


def test_pg_conflicting_committee_decisions_yield_one_authoritative_outcome(pg_promotion):
    """Two DISTINCT, explicitly-assigned committee members racing conflicting
    decisions on the same application — exactly one wins, the other is
    rejected as already-decided."""
    app = create_application(pg_promotion["applicant_headers"])
    app_id = app["id"]
    client.post(
        f"/api/promotions/applications/{app_id}/evidence",
        headers=pg_promotion["applicant_headers"],
        json={"scholarly_asset_ids": pg_promotion["asset_ids"]},
    )
    assign_committee(app_id, pg_promotion["committee_a_id"], pg_promotion["admin_headers"])
    assign_committee(app_id, pg_promotion["committee_b_id"], pg_promotion["admin_headers"])
    submit_res = client.post(f"/api/promotions/applications/{app_id}/submit", headers=pg_promotion["applicant_headers"])
    assert submit_res.status_code == 200

    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker(headers, decision):
        try:
            barrier.wait(timeout=5)
            r = client.post(
                f"/api/promotions/applications/{app_id}/review",
                headers=headers,
                json={"decision": decision, "notes": f"قرار لجنة متزامن: {decision}"},
            )
            results.append((decision, r.status_code))
        except Exception as exc:
            errors.append(exc)

    threads = [
        threading.Thread(target=worker, args=(pg_promotion["committee_a_headers"], "ELIGIBLE_RECOMMENDED")),
        threading.Thread(target=worker, args=(pg_promotion["committee_b_headers"], "INELIGIBLE_DEFICIENT")),
    ]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    oks = [d for d, c in results if c == 200]
    conflicts = [d for d, c in results if c == 409]
    assert len(oks) == 1 and len(conflicts) == 1, f"expected exactly one committee decision to win and the other rejected as already-decided, got {results}"
    with SessionLocal() as db:
        final_app = db.get(models.PromotionApplication, app_id)
    assert final_app.human_review_decision == oks[0]
    assert final_app.status == "COMPLETED"


def test_pg_unauthorized_actor_never_enters_the_decision_race(pg_promotion):
    """An unassigned same-tenant user racing against a real, assigned
    committee member must never win — never entering the authoritative race
    at all, always rejected with 403 regardless of timing."""
    app = create_application(pg_promotion["applicant_headers"])
    app_id = app["id"]
    client.post(
        f"/api/promotions/applications/{app_id}/evidence",
        headers=pg_promotion["applicant_headers"],
        json={"scholarly_asset_ids": pg_promotion["asset_ids"]},
    )
    assign_committee(app_id, pg_promotion["committee_a_id"], pg_promotion["admin_headers"])
    submit_res = client.post(f"/api/promotions/applications/{app_id}/submit", headers=pg_promotion["applicant_headers"])
    assert submit_res.status_code == 200

    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker(headers, label):
        try:
            barrier.wait(timeout=5)
            r = client.post(
                f"/api/promotions/applications/{app_id}/review",
                headers=headers,
                json={"decision": "ELIGIBLE_RECOMMENDED", "notes": f"race actor {label}"},
            )
            results.append((label, r.status_code))
        except Exception as exc:
            errors.append(exc)

    threads = [
        threading.Thread(target=worker, args=(pg_promotion["committee_a_headers"], "assigned")),
        threading.Thread(target=worker, args=(pg_promotion["unassigned_headers"], "unassigned")),
    ]
    [t.start() for t in threads]
    [t.join(timeout=15) for t in threads]

    assert errors == [], f"unhandled exceptions: {errors}"
    result_map = dict(results)
    assert result_map["assigned"] == 200, f"the actually-assigned committee member's decision was not accepted: {results}"
    assert result_map["unassigned"] == 403, f"the unassigned actor must never win or even race authoritatively: {results}"


def test_pg_duplicate_committee_assignment_race_no_duplicate_row(pg_promotion):
    """Concurrent assignment of the same user to the same application's
    committee must never produce two ACTIVE assignment rows."""
    app = create_application(pg_promotion["applicant_headers"])
    app_id = app["id"]
    barrier = threading.Barrier(2)
    results, errors = [], []

    def worker():
        try:
            barrier.wait(timeout=5)
            r = client.post(
                f"/api/promotions/applications/{app_id}/committee",
                headers=pg_promotion["admin_headers"],
                json={"user_id": pg_promotion["committee_a_id"]},
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
        count = db.query(models.PromotionCommitteeAssignment).filter(
            models.PromotionCommitteeAssignment.application_id == app_id,
            models.PromotionCommitteeAssignment.user_id == pg_promotion["committee_a_id"],
            models.PromotionCommitteeAssignment.status == "ACTIVE",
        ).count()
    assert count == 1, "duplicate ACTIVE committee assignment rows created under concurrency"
