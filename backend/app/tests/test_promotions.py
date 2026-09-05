import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.models import (
    User, Organization, OrganizationMembership, Plan, Subscription,
    ScholarlyAsset, PromotionApplication,
    PromotionAssetSelection, PromotionCommitteeAssignment
)
from app.routers.auth import hash_password

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


def create_test_tenant(db, username: str, org_id: str, role: str = "RESEARCHER", user_role: str = "RESEARCHER"):
    user_email = f"{username}@test-univ.edu"
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            id=f"usr-{username}",
            username=username,
            email=user_email,
            hashed_password=hash_password("Password123!"),
            role=user_role,
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(user)

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        org = Organization(
            id=org_id,
            name=f"University {org_id}",
            slug=f"slug-{org_id}",
            organization_type="UNIVERSITY",
            status="ACTIVE",
            owner_user_id=user.id,
            default_language="ar",
            data_region="sa",
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(org)

    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org_id,
        OrganizationMembership.user_id == user.id
    ).first()
    if not membership:
        membership = OrganizationMembership(
            id=f"mbr-{username}",
            organization_id=org.id,
            user_id=user.id,
            role=role,
            status="ACTIVE",
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(membership)

    plan = db.query(Plan).filter(Plan.id == "pln-free").first()
    if not plan:
        plan = Plan(
            id="pln-free",
            code="FREE",
            name="Free Plan",
            name_ar="الخطة المجانية",
            name_en="Free Plan",
            billing_interval="MONTHLY",
            price=0,
            price_minor_units=0,
            currency="SAR",
            features_json={},
            limits_json={"max_projects": 100},
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(plan)

    sub = db.query(Subscription).filter(Subscription.organization_id == org_id).first()
    if not sub:
        sub = Subscription(
            id=f"sub-{org_id}",
            organization_id=org.id,
            plan_id="pln-free",
            status="ACTIVE",
            provider="MOCK",
            current_period_start="2026-08-22T00:00:00Z",
            current_period_end="2036-08-22T00:00:00Z",
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(sub)

    db.commit()
    return user, org


def get_auth_headers(username: str, org_id: str):
    login_res = client.post("/api/auth/login", json={"username": username, "password": "Password123!"})
    token = login_res.json()["token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-Organization-ID": org_id
    }


def create_test_scholarly_asset(db, user: User, org: Organization, asset_id: str, title: str, rank: str, role: str):
    existing = db.query(ScholarlyAsset).filter(ScholarlyAsset.id == asset_id).first()
    if existing:
        return existing

    asset = ScholarlyAsset(
        id=asset_id,
        organization_id=org.id,
        owner_user_id=user.id,
        title_ar=title,
        title_en=title,
        asset_type="JOURNAL_ARTICLE",
        journal_name="International Academic Journal",
        metadata_json={"journal_rank": rank, "author_role": role},
        created_at="2026-08-22T00:00:00Z"
    )
    db.add(asset)
    db.commit()
    return asset


def test_promotion_policy_lifecycle_and_rbac():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    admin_user, org = create_test_tenant(db, f"promo_adm_{suffix}", f"org-promo-{suffix}", role="OWNER")
    researcher_user, _ = create_test_tenant(db, f"promo_res_{suffix}", f"org-promo-{suffix}", role="RESEARCHER")
    org_id = org.id
    db.close()

    admin_headers = get_auth_headers(f"promo_adm_{suffix}", org_id)
    res_headers = get_auth_headers(f"promo_res_{suffix}", org_id)

    # 1. Researcher cannot create policy -> Expect 403
    forbidden_res = client.post(
        "/api/promotions/policies",
        json={
            "name_ar": "لائحة تجريبية",
            "name_en": "Test Policy",
            "target_rank": "ASSOCIATE_PROFESSOR"
        },
        headers=res_headers
    )
    assert forbidden_res.status_code == 403

    # 2. Admin creates institutional policy with criteria
    policy_payload = {
        "name_ar": "لائحة الترقية لرتبة أستاذ مشارك 2026",
        "name_en": "Promotion Bylaws 2026 for Associate Professor",
        "target_rank": "ASSOCIATE_PROFESSOR",
        "rules_json": {"min_total_points": 40.0},
        "criteria": [
            {
                "code": "MIN_PAPERS",
                "title_ar": "الحد الأدنى للأبحاث (4 أبحاث)",
                "title_en": "Minimum 4 papers",
                "criterion_type": "RESEARCH_OUTPUT",
                "min_asset_count": 4,
                "rule_definition_json": {"metric": "asset_count", "operator": ">=", "value": 4},
                "is_mandatory": True,
                "sort_order": 1
            },
            {
                "code": "MIN_POINTS",
                "title_ar": "الحد الأدنى لنقاط النشر (40 نقطة)",
                "title_en": "Minimum 40 points",
                "criterion_type": "RESEARCH_OUTPUT",
                "required_points": 40.0,
                "rule_definition_json": {"metric": "total_points", "operator": ">=", "value": 40.0},
                "is_mandatory": True,
                "sort_order": 2
            }
        ]
    }
    create_res = client.post("/api/promotions/policies", json=policy_payload, headers=admin_headers)
    assert create_res.status_code == 201
    created_policy = create_res.json()
    assert created_policy["target_rank"] == "ASSOCIATE_PROFESSOR"
    assert len(created_policy["criteria"]) == 2


def test_system_admin_without_org_role_can_manage_policies():
    """A platform SystemAdmin (User.role) must pass verify_policy_admin even with
    only a RESEARCHER membership — regression for the ADMIN/ORGANIZATION_ADMIN
    naming mismatch that made this global override unreachable (F13-005)."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    sysadmin, org = create_test_tenant(
        db, f"promo_sysadmin_{suffix}", f"org-promo-sysadmin-{suffix}",
        role="RESEARCHER", user_role="SystemAdmin"
    )
    org_id = org.id
    db.close()

    headers = get_auth_headers(f"promo_sysadmin_{suffix}", org_id)
    res = client.post(
        "/api/promotions/policies",
        json={
            "name_ar": "لائحة إدارية",
            "name_en": "Admin-created policy",
            "target_rank": "ASSOCIATE_PROFESSOR"
        },
        headers=headers
    )
    assert res.status_code == 201


def test_cross_tenant_isolation_promotions():
    db = SessionLocal()
    suffix_a = uuid.uuid4().hex[:6]
    suffix_b = uuid.uuid4().hex[:6]
    user_a, org_a = create_test_tenant(db, f"usr_a_{suffix_a}", f"org-a-{suffix_a}", role="OWNER")
    user_b, org_b = create_test_tenant(db, f"usr_b_{suffix_b}", f"org-b-{suffix_b}", role="OWNER")
    org_a_id = org_a.id
    org_b_id = org_b.id
    db.close()

    headers_a = get_auth_headers(f"usr_a_{suffix_a}", org_a_id)
    headers_b = get_auth_headers(f"usr_b_{suffix_b}", org_b_id)

    # University A creates application
    app_res = client.post(
        "/api/promotions/applications",
        json={"target_rank": "ASSOCIATE_PROFESSOR"},
        headers=headers_a
    )
    assert app_res.status_code == 201
    app_a_id = app_res.json()["id"]

    # University B attempts to get University A's application -> Expect 404
    cross_get = client.get(f"/api/promotions/applications/{app_a_id}", headers=headers_b)
    assert cross_get.status_code == 404

    # University B attempts to evaluate University A's application -> Expect 404
    cross_eval = client.post(f"/api/promotions/applications/{app_a_id}/evaluate", headers=headers_b)
    assert cross_eval.status_code == 404


def test_get_my_application_has_no_side_effects():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    user, org = create_test_tenant(db, f"side_usr_{suffix}", f"org-side-{suffix}", role="RESEARCHER")
    org_id = org.id
    user_id = user.id
    db.close()

    headers = get_auth_headers(f"side_usr_{suffix}", org_id)

    # 1. User has no application: GET should return 404 with NO database record created
    get_res = client.get("/api/promotions/applications/my", headers=headers)
    assert get_res.status_code == 404

    db = SessionLocal()
    app_count = db.query(PromotionApplication).filter(PromotionApplication.user_id == user_id).count()
    assert app_count == 0
    db.close()

    # 2. POST creates application
    post_res = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=headers)
    assert post_res.status_code == 201

    # 3. Subsequent GET returns the application
    get_res_after = client.get("/api/promotions/applications/my", headers=headers)
    assert get_res_after.status_code == 200
    assert get_res_after.json()["id"] == post_res.json()["id"]


def test_policy_version_locking_and_immutability():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    admin, org = create_test_tenant(db, f"p_adm_{suffix}", f"org-pver-{suffix}", role="OWNER")
    res, _ = create_test_tenant(db, f"p_res_{suffix}", f"org-pver-{suffix}", role="RESEARCHER")
    org_id = org.id
    db.close()

    admin_headers = get_auth_headers(f"p_adm_{suffix}", org_id)
    res_headers = get_auth_headers(f"p_res_{suffix}", org_id)

    # 1. Admin creates Policy v1
    create_res = client.post(
        "/api/promotions/policies",
        json={
            "name_ar": "لائحة 2026",
            "name_en": "Bylaws 2026",
            "target_rank": "ASSOCIATE_PROFESSOR",
            "status": "ACTIVE"
        },
        headers=admin_headers
    )
    assert create_res.status_code == 201
    policy_v1 = create_res.json()
    assert policy_v1["version"] == 1

    # 2. Researcher creates Application bound to Policy v1
    app_res = client.post("/api/promotions/applications", json={"policy_id": policy_v1["id"], "target_rank": "ASSOCIATE_PROFESSOR"}, headers=res_headers)
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]
    assert app_res.json()["policy_version"] == 1

    # 3. Attempting to modify ACTIVE Policy v1 directly -> Expect 409 Conflict
    put_res = client.put(
        f"/api/promotions/policies/{policy_v1['id']}",
        json={"name_ar": "لائحة معدلة", "name_en": "Mutated", "target_rank": "ASSOCIATE_PROFESSOR", "status": "ACTIVE"},
        headers=admin_headers
    )
    assert put_res.status_code == 409

    # 4. Admin publishes Policy v2 via new-version endpoint
    new_ver_res = client.post(f"/api/promotions/policies/{policy_v1['id']}/new-version", headers=admin_headers)
    assert new_ver_res.status_code == 201
    policy_v2 = new_ver_res.json()
    assert policy_v2["version"] == 2

    # 5. Existing application remains locked to Policy v1
    app_check = client.get(f"/api/promotions/applications/{app_id}", headers=res_headers)
    assert app_check.json()["policy_version"] == 1
    assert app_check.json()["policy_id"] == policy_v1["id"]


def test_state_machine_and_terminal_state_protection():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    admin, org = create_test_tenant(db, f"sm_adm_{suffix}", f"org-sm-{suffix}", role="OWNER")
    researcher, _ = create_test_tenant(db, f"sm_res_{suffix}", f"org-sm-{suffix}", role="RESEARCHER")
    org_id = org.id
    admin_id = admin.id
    asset_id = f"asset-sm-{suffix}"
    create_test_scholarly_asset(db, researcher, org, asset_id, "Security Systems Paper", "Q1", "sole")
    db.close()

    admin_headers = get_auth_headers(f"sm_adm_{suffix}", org_id)
    res_headers = get_auth_headers(f"sm_res_{suffix}", org_id)

    # 1. Create DRAFT application
    app_res = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=res_headers)
    app_id = app_res.json()["id"]
    assert app_res.json()["status"] == "DRAFT"

    # Committee authority is resource-scoped: admin must be explicitly
    # assigned to THIS application before they may review it at all.
    assign_res = client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": admin_id}, headers=admin_headers)
    assert assign_res.status_code == 201

    # 2. Cannot record committee review on DRAFT -> Expect 409 Conflict
    invalid_review = client.post(
        f"/api/promotions/applications/{app_id}/review",
        json={"decision": "ELIGIBLE_RECOMMENDED", "notes": "Premature review"},
        headers=admin_headers
    )
    assert invalid_review.status_code == 409

    # 3. Add evidence and submit
    client.post(f"/api/promotions/applications/{app_id}/evidence", json={"scholarly_asset_ids": [asset_id]}, headers=res_headers)
    submit_res = client.post(f"/api/promotions/applications/{app_id}/submit", headers=res_headers)
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "SUBMITTED"

    # 4. Cannot re-submit already SUBMITTED application -> Expect 409 Conflict
    re_submit = client.post(f"/api/promotions/applications/{app_id}/submit", headers=res_headers)
    assert re_submit.status_code == 409

    # 5. Cannot add/remove evidence on SUBMITTED file -> Expect 409 Conflict
    add_ev_locked = client.post(f"/api/promotions/applications/{app_id}/evidence", json={"scholarly_asset_ids": [asset_id]}, headers=res_headers)
    assert add_ev_locked.status_code == 409

    # 6. Committee Review renders terminal decision COMPLETED
    rev_res = client.post(
        f"/api/promotions/applications/{app_id}/review",
        json={"decision": "ELIGIBLE_RECOMMENDED", "notes": "Approved by academic board"},
        headers=admin_headers
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["status"] == "COMPLETED"

    # 7. Terminal state protection: Cannot mutate COMPLETED application
    del_ev_completed = client.delete(f"/api/promotions/applications/{app_id}/evidence/{asset_id}", headers=res_headers)
    assert del_ev_completed.status_code == 409


def test_evidence_snapshot_immutability_and_ownership():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    res_a, org = create_test_tenant(db, f"res_snapa_{suffix}", f"org-snap-{suffix}", role="RESEARCHER")
    res_b, _ = create_test_tenant(db, f"res_snapb_{suffix}", f"org-snap-{suffix}", role="RESEARCHER")
    org_id = org.id
    asset_a_id = f"asset-snap-a-{suffix}"
    asset_b_id = f"asset-snap-b-{suffix}"
    create_test_scholarly_asset(db, res_a, org, asset_a_id, "Quantum Physics", "Q1", "sole")
    create_test_scholarly_asset(db, res_b, org, asset_b_id, "Biotechnology", "Q2", "first")
    db.close()

    headers_a = get_auth_headers(f"res_snapa_{suffix}", org_id)
    headers_b = get_auth_headers(f"res_snapb_{suffix}", org_id)

    app_res = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=headers_a)
    app_id = app_res.json()["id"]

    # 1. Researcher A attempts to add Researcher B's asset -> Expect 403 Forbidden
    cross_user_ev = client.post(
        f"/api/promotions/applications/{app_id}/evidence",
        json={"scholarly_asset_ids": [asset_b_id]},
        headers=headers_a
    )
    assert cross_user_ev.status_code == 403

    # 2. Researcher A adds own asset
    own_ev = client.post(
        f"/api/promotions/applications/{app_id}/evidence",
        json={"scholarly_asset_ids": [asset_a_id]},
        headers=headers_a
    )
    assert own_ev.status_code == 200
    assert len(own_ev.json()["evidence_selections"]) == 1

    # 3. Mutate live ScholarlyAsset in DB to simulate post-submission changes
    db = SessionLocal()
    live_asset = db.query(ScholarlyAsset).filter(ScholarlyAsset.id == asset_a_id).first()
    live_asset.title_ar = "Changed Live Title"
    live_asset.metadata_json = {"journal_rank": "Q4", "author_role": "co-author"}
    db.commit()

    # 4. Verify historical snapshot in PromotionAssetSelection remained immutable
    snap_record = db.query(PromotionAssetSelection).filter(
        PromotionAssetSelection.promotion_application_id == app_id,
        PromotionAssetSelection.scholarly_asset_id == asset_a_id
    ).first()
    snapshot_json = snap_record.evidence_snapshot_json
    assert snapshot_json["title_ar"] == "Quantum Physics"
    assert snapshot_json["metadata"]["journal_rank"] == "Q1"
    assert snapshot_json["metadata"]["author_role"] == "sole"
    db.close()


def test_rules_engine_security_and_numeric_boundaries():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    user, org = create_test_tenant(db, f"sec_usr_{suffix}", f"org-sec-{suffix}", role="RESEARCHER")
    org_id = org.id
    asset_id = f"asset-sec-{suffix}"
    create_test_scholarly_asset(db, user, org, asset_id, "Secure Computing", "Q1", "sole")
    db.close()

    headers = get_auth_headers(f"sec_usr_{suffix}", org_id)

    app_res = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=headers)
    app_id = app_res.json()["id"]

    client.post(f"/api/promotions/applications/{app_id}/evidence", json={"scholarly_asset_ids": [asset_id]}, headers=headers)

    # Evaluate
    eval_res = client.post(f"/api/promotions/applications/{app_id}/evaluate", headers=headers)
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert 0 <= eval_data["readiness_percentage"] <= 100
    assert eval_data["total_calculated_points"] == 20.0
    assert not eval_data["is_stale"]

    # Test Stale Evaluation Detection on Evidence change
    del_res = client.delete(f"/api/promotions/applications/{app_id}/evidence/{asset_id}", headers=headers)
    assert del_res.status_code == 200

    app_read = client.get(f"/api/promotions/applications/{app_id}", headers=headers)
    assert app_read.status_code == 200
    assert app_read.json()["evaluation_summary_json"]["is_stale"] is True


def test_same_tenant_researcher_isolation():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    res_a, org = create_test_tenant(db, f"iso_a_{suffix}", f"org-iso-{suffix}", role="RESEARCHER")
    res_b, _ = create_test_tenant(db, f"iso_b_{suffix}", f"org-iso-{suffix}", role="RESEARCHER")
    org_id = org.id
    db.close()

    headers_a = get_auth_headers(f"iso_a_{suffix}", org_id)
    headers_b = get_auth_headers(f"iso_b_{suffix}", org_id)

    app_a = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=headers_a).json()

    # Researcher B cannot view Researcher A's application -> Expect 403 Forbidden
    res_b_view = client.get(f"/api/promotions/applications/{app_a['id']}", headers=headers_b)
    assert res_b_view.status_code == 403

    # Researcher B cannot evaluate Researcher A's application -> Expect 403 Forbidden
    res_b_eval = client.post(f"/api/promotions/applications/{app_a['id']}/evaluate", headers=headers_b)
    assert res_b_eval.status_code == 403


def _setup_committee_authority_fixture(suffix):
    """Shared fixture for the resource-scoped committee authority test
    matrix: an applicant, an org OWNER (admin authority, NOT auto-committee),
    a platform SystemAdmin (also NOT auto-committee), a same-tenant
    unassigned researcher, and a cross-tenant outsider."""
    db = SessionLocal()
    org_id = f"org-committee-{suffix}"
    outsider_org_id = f"org-committee-other-{suffix}"
    applicant, org = create_test_tenant(db, f"cm_appl_{suffix}", org_id, role="RESEARCHER")
    owner, _ = create_test_tenant(db, f"cm_owner_{suffix}", org_id, role="OWNER")
    sysadmin, _ = create_test_tenant(db, f"cm_sysadmin_{suffix}", org_id, role="RESEARCHER", user_role="SystemAdmin")
    unassigned, _ = create_test_tenant(db, f"cm_unassigned_{suffix}", org_id, role="RESEARCHER")
    reviewer, _ = create_test_tenant(db, f"cm_reviewer_{suffix}", org_id, role="RESEARCHER")
    outsider, _ = create_test_tenant(db, f"cm_outsider_{suffix}", outsider_org_id, role="OWNER")
    applicant_id, owner_id, sysadmin_id, unassigned_id, reviewer_id, outsider_id = (
        applicant.id, owner.id, sysadmin.id, unassigned.id, reviewer.id, outsider.id
    )
    db.close()

    return {
        "org_id": org_id,
        "applicant_id": applicant_id,
        "applicant_headers": get_auth_headers(f"cm_appl_{suffix}", org_id),
        "owner_id": owner_id,
        "owner_headers": get_auth_headers(f"cm_owner_{suffix}", org_id),
        "sysadmin_id": sysadmin_id,
        "sysadmin_headers": get_auth_headers(f"cm_sysadmin_{suffix}", org_id),
        "unassigned_id": unassigned_id,
        "unassigned_headers": get_auth_headers(f"cm_unassigned_{suffix}", org_id),
        "reviewer_id": reviewer_id,
        "reviewer_headers": get_auth_headers(f"cm_reviewer_{suffix}", org_id),
        "outsider_id": outsider_id,
        "outsider_org_id": outsider_org_id,
        "outsider_headers": get_auth_headers(f"cm_outsider_{suffix}", outsider_org_id),
    }


def test_platform_admin_cannot_view_private_promotion_application():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    r = client.get(f"/api/promotions/applications/{app_id}", headers=f["sysadmin_headers"])
    assert r.status_code == 403


def test_platform_admin_cannot_evaluate_promotion_application():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    r = client.post(f"/api/promotions/applications/{app_id}/evaluate", headers=f["sysadmin_headers"])
    assert r.status_code == 403


def test_platform_admin_cannot_record_committee_decision():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    client.post(f"/api/promotions/applications/{app_id}/submit", headers=f["applicant_headers"])
    r = client.post(f"/api/promotions/applications/{app_id}/review", headers=f["sysadmin_headers"],
                     json={"decision": "ELIGIBLE_RECOMMENDED", "notes": "Platform admin attempt"})
    assert r.status_code == 403


def test_organization_admin_without_committee_assignment_cannot_review():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    client.post(f"/api/promotions/applications/{app_id}/submit", headers=f["applicant_headers"])
    r = client.post(f"/api/promotions/applications/{app_id}/review", headers=f["owner_headers"],
                     json={"decision": "ELIGIBLE_RECOMMENDED", "notes": "Owner without assignment attempt"})
    assert r.status_code == 403


def test_organization_admin_without_committee_assignment_cannot_evaluate():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    r = client.post(f"/api/promotions/applications/{app_id}/evaluate", headers=f["owner_headers"])
    assert r.status_code == 403


def test_organization_admin_retains_read_only_oversight_without_assignment():
    """The one deliberately-scoped exception: org OWNER/ORGANIZATION_ADMIN
    retain read-only GET access to any in-org dossier for institutional
    transparency, even without a committee assignment — but the response is a
    server-side-projected administrative-metadata view, never the private
    academic dossier (no evidence, no readiness/points, no evaluation, no
    is_committee_member field at all — that field only exists on the full
    PromotionApplicationResponse shape)."""
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    r = client.get(f"/api/promotions/applications/{app_id}", headers=f["owner_headers"])
    assert r.status_code == 200
    body = r.json()
    assert body["is_admin_metadata_only"] is True
    assert body["status"] == "DRAFT"
    assert "is_committee_member" not in body
    assert "evidence_selections" not in body
    assert "readiness_percentage" not in body
    assert "total_calculated_points" not in body
    assert "evaluation_summary_json" not in body
    assert "human_review_notes" not in body


def test_assigned_committee_member_can_view_and_evaluate_assigned_application():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    assign = client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["owner_headers"])
    assert assign.status_code == 201

    view = client.get(f"/api/promotions/applications/{app_id}", headers=f["reviewer_headers"])
    assert view.status_code == 200
    assert view.json()["is_committee_member"] is True

    eval_res = client.post(f"/api/promotions/applications/{app_id}/evaluate", headers=f["reviewer_headers"])
    assert eval_res.status_code == 200


def test_committee_assignment_grants_resource_scoped_authority_over_decision():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["owner_headers"])
    client.post(f"/api/promotions/applications/{app_id}/submit", headers=f["applicant_headers"])

    decision = client.post(f"/api/promotions/applications/{app_id}/review", headers=f["reviewer_headers"],
                            json={"decision": "ELIGIBLE_RECOMMENDED", "notes": "Assigned committee member decision"})
    assert decision.status_code == 200
    assert decision.json()["status"] == "COMPLETED"


def test_committee_member_cannot_review_unassigned_same_tenant_application():
    """Horizontal IDOR check: a user who IS a committee member on some other
    application (or none at all) cannot act on an application they were
    never assigned to, even within the same organization."""
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    client.post(f"/api/promotions/applications/{app_id}/submit", headers=f["applicant_headers"])

    r = client.post(f"/api/promotions/applications/{app_id}/review", headers=f["unassigned_headers"],
                     json={"decision": "ELIGIBLE_RECOMMENDED", "notes": "Unassigned same-tenant attempt"})
    assert r.status_code == 403

    view = client.get(f"/api/promotions/applications/{app_id}", headers=f["unassigned_headers"])
    assert view.status_code == 403


def test_committee_assignment_revocation_removes_authority():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["owner_headers"])

    before = client.get(f"/api/promotions/applications/{app_id}", headers=f["reviewer_headers"])
    assert before.status_code == 200

    revoke = client.delete(f"/api/promotions/applications/{app_id}/committee/{f['reviewer_id']}", headers=f["owner_headers"])
    assert revoke.status_code == 200
    assert revoke.json()["status"] == "REVOKED"

    after = client.get(f"/api/promotions/applications/{app_id}", headers=f["reviewer_headers"])
    assert after.status_code == 403


def test_applicant_cannot_be_assigned_to_own_committee():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    r = client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["applicant_id"]}, headers=f["owner_headers"])
    assert r.status_code == 422


def test_committee_assignment_requires_admin_authority():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    r = client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["reviewer_headers"])
    assert r.status_code == 403


def test_committee_assignment_cross_tenant_target_rejected():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    r = client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["outsider_id"]}, headers=f["owner_headers"])
    assert r.status_code == 404


def test_committee_assignment_cross_tenant_application_rejected():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    # An OWNER from a different organization cannot assign a committee on an
    # application that isn't theirs — the application lookup itself is
    # tenant-scoped, so this correctly resolves as not-found.
    r = client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["outsider_id"]}, headers=f["outsider_headers"])
    assert r.status_code == 404


def test_duplicate_committee_assignment_rejected():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    first = client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["owner_headers"])
    assert first.status_code == 201
    second = client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["owner_headers"])
    assert second.status_code == 409


def test_platform_admin_cannot_assign_promotion_committee():
    """Deciding who sits on an applicant's promotion committee is
    institutional academic governance, not platform operations — a platform
    SystemAdmin gets nothing here, unlike verify_policy_admin's bylaws scope."""
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    r = client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["sysadmin_headers"])
    assert r.status_code == 403


def test_org_admin_assignment_authority_does_not_grant_dossier_access():
    """The authority to CONFIGURE the committee (verify_committee_admin) does
    not itself confer private-dossier access — an admin who assigns someone
    ELSE to the committee gains nothing personally unless also assigned."""
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    assign = client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["owner_headers"])
    assert assign.status_code == 201
    # The assigning OWNER still only gets the metadata-only oversight view,
    # not the private dossier, purely by virtue of having made the assignment.
    view = client.get(f"/api/promotions/applications/{app_id}", headers=f["owner_headers"])
    assert view.status_code == 200
    assert view.json()["is_admin_metadata_only"] is True
    eval_res = client.post(f"/api/promotions/applications/{app_id}/evaluate", headers=f["owner_headers"])
    assert eval_res.status_code == 403


def test_committee_revocation_removes_evaluation_and_decision_authority_specifically():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["owner_headers"])
    client.post(f"/api/promotions/applications/{app_id}/submit", headers=f["applicant_headers"])

    eval_before = client.post(f"/api/promotions/applications/{app_id}/evaluate", headers=f["reviewer_headers"])
    assert eval_before.status_code == 200

    revoke = client.delete(f"/api/promotions/applications/{app_id}/committee/{f['reviewer_id']}", headers=f["owner_headers"])
    assert revoke.status_code == 200

    eval_after = client.post(f"/api/promotions/applications/{app_id}/evaluate", headers=f["reviewer_headers"])
    assert eval_after.status_code == 403
    decide_after = client.post(f"/api/promotions/applications/{app_id}/review", headers=f["reviewer_headers"],
                                json={"decision": "ELIGIBLE_RECOMMENDED", "notes": "Post-revocation attempt"})
    assert decide_after.status_code == 403


def test_revoked_committee_member_loses_search_access():
    """Tests PromotionProvider.build_base() directly (the exact code changed
    this round), rather than through GET /api/search — the shared test-suite
    plan ("pln-free") gets its PROMOTION_ENGINE entitlement auto-provisioned
    to False as a side effect of app requests made by this test's own setup,
    which is an unrelated billing/entitlement concern, not the resource-scoped
    search-visibility property under test here."""
    from app.services.search.providers import get_provider
    from app.services.tenant_context import TenantContext

    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_res = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"])
    app_id = app_res.json()["id"]
    client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["owner_headers"])

    db = SessionLocal()
    reviewer = db.query(User).filter(User.id == f["reviewer_id"]).first()
    org = db.query(Organization).filter(Organization.id == f["org_id"]).first()
    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == f["org_id"], OrganizationMembership.user_id == f["reviewer_id"]
    ).first()
    sub = db.query(Subscription).filter(Subscription.organization_id == f["org_id"]).first()
    plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
    ctx = TenantContext(user=reviewer, organization=org, membership=membership, subscription=sub, plan=plan, subscription_owner_id=org.owner_user_id)

    provider = get_provider("PROMOTION")
    visible_ids_before = {row.id for row in provider.build_base(db, ctx).all()}
    assert app_id in visible_ids_before

    db.close()
    client.delete(f"/api/promotions/applications/{app_id}/committee/{f['reviewer_id']}", headers=f["owner_headers"])

    db2 = SessionLocal()
    visible_ids_after = {row.id for row in provider.build_base(db2, ctx).all()}
    db2.close()
    assert app_id not in visible_ids_after


def test_revoked_committee_member_loses_ai_context():
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    client.post(f"/api/promotions/applications/{app_id}/committee", json={"user_id": f["reviewer_id"]}, headers=f["owner_headers"])
    client.delete(f"/api/promotions/applications/{app_id}/committee/{f['reviewer_id']}", headers=f["owner_headers"])

    r = client.post("/api/ai/assist", json={
        "use_case": "PROMOTION_EVIDENCE_SUMMARY", "application_id": app_id,
    }, headers=f["reviewer_headers"])
    assert r.status_code in (400, 403)


def test_applicant_cannot_review_own_application_even_if_directly_assigned():
    """Defense in depth: even bypassing the assignment endpoint's own guard
    (which already rejects assigning the applicant via the API) by inserting
    a committee row directly, the review endpoint's own self-review check
    must still block the applicant from deciding their own case."""
    f = _setup_committee_authority_fixture(uuid.uuid4().hex[:6])
    app_id = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=f["applicant_headers"]).json()["id"]
    client.post(f"/api/promotions/applications/{app_id}/submit", headers=f["applicant_headers"])

    db = SessionLocal()
    db.add(PromotionCommitteeAssignment(
        id=f"pca-selfreview-{uuid.uuid4().hex[:6]}", organization_id=f["org_id"], application_id=app_id,
        user_id=f["applicant_id"], assigned_by=f["owner_id"], status="ACTIVE", assigned_at="2026-08-22T00:00:00Z"
    ))
    db.commit()
    db.close()

    r = client.post(f"/api/promotions/applications/{app_id}/review", headers=f["applicant_headers"],
                     json={"decision": "ELIGIBLE_RECOMMENDED", "notes": "Self-review attempt"})
    assert r.status_code == 403
