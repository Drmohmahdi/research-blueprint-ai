import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.models import (
    User, Organization, OrganizationMembership, Plan, Subscription,
    ScholarlyAsset, ScholarlyAssetContributor,
    PromotionPolicy, PromotionCriterion, PromotionApplication,
    PromotionAssetSelection, PromotionEvaluationSnapshot, AuditLog
)
from app.routers.auth import hash_password
from app.services.promotion_evaluator import (
    evaluate_promotion_application,
    compute_evidence_points,
    generate_evaluation_fingerprint
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


def create_test_tenant(db, username: str, org_id: str, role: str = "RESEARCHER"):
    user_email = f"{username}@test-univ.edu"
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            id=f"usr-{username}",
            username=username,
            email=user_email,
            hashed_password=hash_password("Password123!"),
            role="RESEARCHER",
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
            name_ar="الخطة المجانية",
            name_en="Free Plan",
            tier="FREE",
            monthly_price=0,
            annual_price=0,
            features_json={},
            limits_json={"projects_limit": 100}
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
    asset_id = f"asset-sm-{suffix}"
    create_test_scholarly_asset(db, researcher, org, asset_id, "Security Systems Paper", "Q1", "sole")
    db.close()

    admin_headers = get_auth_headers(f"sm_adm_{suffix}", org_id)
    res_headers = get_auth_headers(f"sm_res_{suffix}", org_id)

    # 1. Create DRAFT application
    app_res = client.post("/api/promotions/applications", json={"target_rank": "ASSOCIATE_PROFESSOR"}, headers=res_headers)
    app_id = app_res.json()["id"]
    assert app_res.json()["status"] == "DRAFT"

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
