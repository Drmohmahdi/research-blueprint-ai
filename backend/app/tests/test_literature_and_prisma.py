import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.models import User, ResearchProject, Organization, OrganizationMembership, Plan, Subscription
from app.routers.auth import hash_password

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


def create_test_tenant(db, username: str, org_id: str, email: str):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            id=f"usr-{username}",
            username=username,
            email=email,
            hashed_password=hash_password("Password123!"),
            role="RESEARCHER",
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(user)

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        org = Organization(
            id=org_id,
            name=f"Org {org_id}",
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
            role="OWNER",
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


def create_test_project(db, user: User, org: Organization, project_id: str):
    existing = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
    if existing:
        return existing
    project = ResearchProject(
        id=project_id,
        userId=user.id,
        organizationId=org.id,
        titleAr="دراسة تجريبية للأدلة والمراجعة المنهجية",
        titleEn="Experimental Meta-Analysis & Evidence Synthesis Study",
        studyDesign="quasi_experimental_pre_post",
        sampleSettings={"populationSize": 120, "marginOfError": 0.05, "expectedPower": 0.8, "expectedEffectSize": 0.5, "expectedAttritionRate": 0.1, "groupsCount": 2},
        version=1
    )
    db.add(project)
    db.commit()
    return project


def get_auth_headers(username: str, org_id: str):
    login_res = client.post("/api/auth/login", json={"username": username, "password": "Password123!"})
    token = login_res.json()["token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-Organization-ID": org_id
    }


def test_literature_synthesis_crud_and_calculations():
    db = SessionLocal()
    user, org = create_test_tenant(db, "meta_tester", "org-meta-1", "meta@test.com")
    project = create_test_project(db, user, org, "proj-meta-1")
    project_id = project.id
    db.close()

    headers = get_auth_headers("meta_tester", "org-meta-1")

    # 1. Initial GET - empty synthesis
    res = client.get(f"/api/projects/{project_id}/literature-synthesis", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["projectId"] == project_id
    assert data["totalStudies"] == 0
    assert data["totalSampleCount"] == 0
    assert data["pooledEffectSize"] == 0.0

    # 2. Add First Study
    study1_payload = {
        "id": "study-1",
        "author": "Al-Mansoor et al.",
        "year": 2023,
        "sampleSize": 80,
        "effectSize": 0.60,
        "ciLower": 0.20,
        "ciUpper": 1.00,
        "source": "manual",
        "notes": "Pilot RCT study"
    }
    res = client.post(f"/api/projects/{project_id}/literature-synthesis/studies", json=study1_payload, headers=headers)
    assert res.status_code == 201
    created_study1 = res.json()
    assert created_study1["id"] == "study-1"
    assert created_study1["author"] == "Al-Mansoor et al."

    # 3. Add Second Study
    study2_payload = {
        "id": "study-2",
        "author": "Johnson & Lee",
        "year": 2024,
        "sampleSize": 120,
        "effectSize": 0.70,
        "ciLower": 0.35,
        "ciUpper": 1.05,
        "source": "manual"
    }
    res = client.post(f"/api/projects/{project_id}/literature-synthesis/studies", json=study2_payload, headers=headers)
    assert res.status_code == 201

    # 4. Get Synthesis & verify pooled effect size and sample count
    res = client.get(f"/api/projects/{project_id}/literature-synthesis", headers=headers)
    assert res.status_code == 200
    synth = res.json()
    assert synth["totalStudies"] == 2
    assert synth["totalSampleCount"] == 200
    assert 0.5 < synth["pooledEffectSize"] < 0.8
    assert synth["pooledLower"] < synth["pooledEffectSize"] < synth["pooledUpper"]

    # 5. Delete Study 1
    res = client.delete(f"/api/projects/{project_id}/literature-synthesis/studies/study-1", headers=headers)
    assert res.status_code == 204

    # 6. Verify 1 study remains
    res = client.get(f"/api/projects/{project_id}/literature-synthesis", headers=headers)
    assert res.status_code == 200
    assert res.json()["totalStudies"] == 1

    # 7. Batch sync (migration simulation)
    batch_payload = {
        "studies": [
            {"id": "study-batch-1", "author": "Smith", "year": 2022, "sampleSize": 50, "effectSize": 0.45, "ciLower": 0.1, "ciUpper": 0.8},
            {"id": "study-batch-2", "author": "Hassan", "year": 2023, "sampleSize": 90, "effectSize": 0.55, "ciLower": 0.2, "ciUpper": 0.9}
        ]
    }
    res = client.put(f"/api/projects/{project_id}/literature-synthesis/sync", json=batch_payload, headers=headers)
    assert res.status_code == 200
    assert res.json()["totalStudies"] == 2
    assert res.json()["totalSampleCount"] == 140

    # 8. Clear synthesis
    res = client.delete(f"/api/projects/{project_id}/literature-synthesis", headers=headers)
    assert res.status_code == 204
    res = client.get(f"/api/projects/{project_id}/literature-synthesis", headers=headers)
    assert res.json()["totalStudies"] == 0


def test_prisma_flow_persistence_and_calculations():
    db = SessionLocal()
    user, org = create_test_tenant(db, "prisma_tester", "org-prisma-1", "prisma@test.com")
    project = create_test_project(db, user, org, "proj-prisma-1")
    project_id = project.id
    db.close()

    headers = get_auth_headers("prisma_tester", "org-prisma-1")

    # 1. Initial GET
    res = client.get(f"/api/projects/{project_id}/prisma-flow", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["identified"] == 0
    assert data["included"] == 0

    # 2. Upsert PRISMA Counts
    payload = {
        "identified": 250,
        "duplicates": 30,
        "excludedScreening": 120,
        "excludedEligibility": 40,
        "source": "manual",
        "notes": "Systematic search across PubMed, Scopus, Web of Science"
    }
    res = client.put(f"/api/projects/{project_id}/prisma-flow", json=payload, headers=headers)
    assert res.status_code == 200
    flow = res.json()
    assert flow["identified"] == 250
    assert flow["duplicates"] == 30
    assert flow["screened"] == 220 # 250 - 30
    assert flow["excludedScreening"] == 120
    assert flow["eligible"] == 100 # 220 - 120
    assert flow["excludedEligibility"] == 40
    assert flow["included"] == 60 # 100 - 40

    # 3. GET again and verify persistence
    res = client.get(f"/api/projects/{project_id}/prisma-flow", headers=headers)
    assert res.status_code == 200
    assert res.json()["included"] == 60

    # 4. Reset PRISMA Flow
    res = client.delete(f"/api/projects/{project_id}/prisma-flow", headers=headers)
    assert res.status_code == 204

    # 5. Verify default reset state
    res = client.get(f"/api/projects/{project_id}/prisma-flow", headers=headers)
    assert res.json()["identified"] == 0
    assert res.json()["included"] == 0


def test_cross_tenant_isolation_literature_and_prisma():
    db = SessionLocal()
    user_a, org_a = create_test_tenant(db, "tenant_a_user", "org-tenant-a", "user_a@test.com")
    user_b, org_b = create_test_tenant(db, "tenant_b_user", "org-tenant-b", "user_b@test.com")
    project_a = create_test_project(db, user_a, org_a, "proj-tenant-a-1")
    project_a_id = project_a.id
    db.close()

    headers_a = get_auth_headers("tenant_a_user", "org-tenant-a")
    headers_b = get_auth_headers("tenant_b_user", "org-tenant-b")

    # Tenant A creates literature study and PRISMA record
    client.post(
        f"/api/projects/{project_a_id}/literature-synthesis/studies",
        json={"author": "Secret Study A", "year": 2023, "sampleSize": 50, "effectSize": 0.5, "ciLower": 0.1, "ciUpper": 0.9},
        headers=headers_a
    )
    client.put(
        f"/api/projects/{project_a_id}/prisma-flow",
        json={"identified": 500, "duplicates": 50, "excludedScreening": 200, "excludedEligibility": 50},
        headers=headers_a
    )

    # Tenant B tries to access Tenant A's Project Literature -> Expect 404 (Not Found in Tenant B)
    res_lit_get = client.get(f"/api/projects/{project_a_id}/literature-synthesis", headers=headers_b)
    assert res_lit_get.status_code == 404

    res_lit_post = client.post(
        f"/api/projects/{project_a_id}/literature-synthesis/studies",
        json={"author": "Malicious Injection", "year": 2024, "sampleSize": 10, "effectSize": 0.1, "ciLower": 0.0, "ciUpper": 0.2},
        headers=headers_b
    )
    assert res_lit_post.status_code == 404

    # Tenant B tries to access Tenant A's PRISMA -> Expect 404
    res_prisma_get = client.get(f"/api/projects/{project_a_id}/prisma-flow", headers=headers_b)
    assert res_prisma_get.status_code == 404

    res_prisma_put = client.put(
        f"/api/projects/{project_a_id}/prisma-flow",
        json={"identified": 0, "duplicates": 0, "excludedScreening": 0, "excludedEligibility": 0},
        headers=headers_b
    )
    assert res_prisma_put.status_code == 404


def test_input_validation_errors():
    db = SessionLocal()
    user, org = create_test_tenant(db, "val_user", "org-val-1", "val@test.com")
    project = create_test_project(db, user, org, "proj-val-1")
    project_id = project.id
    db.close()

    headers = get_auth_headers("val_user", "org-val-1")

    # Invalid sample size (0 or negative) -> Expect 422
    res = client.post(
        f"/api/projects/{project_id}/literature-synthesis/studies",
        json={"author": "Invalid N", "year": 2023, "sampleSize": 0, "effectSize": 0.5, "ciLower": 0.1, "ciUpper": 0.9},
        headers=headers
    )
    assert res.status_code == 422

    # Invalid Confidence Interval (ciLower > ciUpper) -> Expect 422
    res = client.post(
        f"/api/projects/{project_id}/literature-synthesis/studies",
        json={"author": "Invalid CI", "year": 2023, "sampleSize": 50, "effectSize": 0.5, "ciLower": 0.9, "ciUpper": 0.1},
        headers=headers
    )
    assert res.status_code == 422

    # Invalid PRISMA negative numbers -> Expect 422
    res = client.put(
        f"/api/projects/{project_id}/prisma-flow",
        json={"identified": -5, "duplicates": 0, "excludedScreening": 0, "excludedEligibility": 0},
        headers=headers
    )
    assert res.status_code == 422


def test_prisma_cross_field_validation():
    db = SessionLocal()
    user, org = create_test_tenant(db, "prisma_val_user", "org-prisma-val", "prismaval@test.com")
    project = create_test_project(db, user, org, "proj-prisma-val")
    project_id = project.id
    db.close()

    headers = get_auth_headers("prisma_val_user", "org-prisma-val")

    # 1. duplicates > identified -> Expect 422
    res = client.put(
        f"/api/projects/{project_id}/prisma-flow",
        json={"identified": 100, "duplicates": 150, "excludedScreening": 0, "excludedEligibility": 0},
        headers=headers
    )
    assert res.status_code == 422

    # 2. excludedScreening > screened (100 - 20 = 80, but excludedScreening = 90) -> Expect 422
    res = client.put(
        f"/api/projects/{project_id}/prisma-flow",
        json={"identified": 100, "duplicates": 20, "excludedScreening": 90, "excludedEligibility": 0},
        headers=headers
    )
    assert res.status_code == 422

    # 3. excludedEligibility > eligible (100 - 20 - 50 = 30, but excludedEligibility = 40) -> Expect 422
    res = client.put(
        f"/api/projects/{project_id}/prisma-flow",
        json={"identified": 100, "duplicates": 20, "excludedScreening": 50, "excludedEligibility": 40},
        headers=headers
    )
    assert res.status_code == 422

    # 4. Valid flow -> Expect 200 and correct calculated fields
    res = client.put(
        f"/api/projects/{project_id}/prisma-flow",
        json={"identified": 100, "duplicates": 20, "excludedScreening": 50, "excludedEligibility": 20},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["screened"] == 80
    assert data["eligible"] == 30
    assert data["included"] == 10


def test_legacy_migration_idempotency_and_retry():
    db = SessionLocal()
    user, org = create_test_tenant(db, "idemp_user", "org-idemp", "idemp@test.com")
    project = create_test_project(db, user, org, "proj-idemp")
    project_id = project.id
    db.close()

    headers = get_auth_headers("idemp_user", "org-idemp")

    migration_payload = {
        "studies": [
            {"id": "migrated-1", "author": "Smith et al.", "year": 2021, "sampleSize": 60, "effectSize": 0.40, "ciLower": 0.10, "ciUpper": 0.70},
            {"id": "migrated-2", "author": "Jones et al.", "year": 2022, "sampleSize": 80, "effectSize": 0.60, "ciLower": 0.30, "ciUpper": 0.90}
        ]
    }

    # First migration run
    res1 = client.put(f"/api/projects/{project_id}/literature-synthesis/sync", json=migration_payload, headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["totalStudies"] == 2
    assert data1["totalSampleCount"] == 140

    # Second migration run (retry / page reload simulation)
    res2 = client.put(f"/api/projects/{project_id}/literature-synthesis/sync", json=migration_payload, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["totalStudies"] == 2
    assert data2["totalSampleCount"] == 140
    assert data2["pooledEffectSize"] == data1["pooledEffectSize"]
    assert len(data2["studies"]) == 2


def test_literature_statistical_golden_test():
    """
    Golden Dataset:
    Study 1: d=0.50, CI=[0.10, 0.90] (width=0.80, SE=0.8/3.92 ~ 0.20408, weight ~ 24.01)
    Study 2: d=0.80, CI=[0.40, 1.20] (width=0.80, SE=0.8/3.92 ~ 0.20408, weight ~ 24.01)
    Study 3: d=0.20, CI=[-0.20, 0.60] (width=0.80, SE=0.8/3.92 ~ 0.20408, weight ~ 24.01)

    Equal weights => Pooled d = (0.50 + 0.80 + 0.20)/3 = 0.50
    Pooled SE = 1/sqrt(3 * 24.01) = 1/sqrt(72.03) ~ 0.1178
    Pooled 95% CI: 0.50 +/- 1.96 * 0.1178 = [0.27, 0.73]
    Cochran's Q = 24.01 * ((0)^2 + (0.3)^2 + (-0.3)^2) = 24.01 * 0.18 = 4.32
    I^2 = (4.32 - 2) / 4.32 * 100 = 53.7%
    """
    db = SessionLocal()
    user, org = create_test_tenant(db, "stat_user", "org-stat-golden", "stat@test.com")
    project = create_test_project(db, user, org, "proj-stat-golden")
    project_id = project.id
    db.close()

    headers = get_auth_headers("stat_user", "org-stat-golden")

    golden_payload = {
        "studies": [
            {"id": "gold-1", "author": "Study Alpha", "year": 2021, "sampleSize": 50, "effectSize": 0.50, "ciLower": 0.10, "ciUpper": 0.90},
            {"id": "gold-2", "author": "Study Beta", "year": 2022, "sampleSize": 50, "effectSize": 0.80, "ciLower": 0.40, "ciUpper": 1.20},
            {"id": "gold-3", "author": "Study Gamma", "year": 2023, "sampleSize": 50, "effectSize": 0.20, "ciLower": -0.20, "ciUpper": 0.60}
        ]
    }

    res = client.put(f"/api/projects/{project_id}/literature-synthesis/sync", json=golden_payload, headers=headers)
    assert res.status_code == 200
    metrics = res.json()

    assert metrics["totalStudies"] == 3
    assert metrics["totalSampleCount"] == 150
    assert abs(metrics["pooledEffectSize"] - 0.50) < 0.01
    assert abs(metrics["pooledLower"] - 0.27) < 0.02
    assert abs(metrics["pooledUpper"] - 0.73) < 0.02
    assert abs(metrics["heterogeneityQ"] - 4.32) < 0.05
    assert abs(metrics["heterogeneityI2"] - 53.7) < 0.5


def test_audit_logging_and_trusted_tenant_binding():
    db = SessionLocal()
    user, org = create_test_tenant(db, "audit_tester", "org-audit-test", "audit@test.com")
    project = create_test_project(db, user, org, "proj-audit-test")
    org_id = org.id
    project_id = project.id
    db.close()

    headers = get_auth_headers("audit_tester", org_id)

    # Add study
    client.post(
        f"/api/projects/{project_id}/literature-synthesis/studies",
        json={"id": "audit-study-1", "author": "Dr. Researcher", "year": 2024, "sampleSize": 100, "effectSize": 0.55, "ciLower": 0.25, "ciUpper": 0.85},
        headers=headers
    )

    # Upsert PRISMA
    client.put(
        f"/api/projects/{project_id}/prisma-flow",
        json={"identified": 300, "duplicates": 40, "excludedScreening": 150, "excludedEligibility": 50},
        headers=headers
    )

    # Delete study
    client.delete(f"/api/projects/{project_id}/literature-synthesis/studies/audit-study-1", headers=headers)

    # Inspect AuditLog entries in DB
    db = SessionLocal()
    from app.models import AuditLog, PrismaFlow
    logs = db.query(AuditLog).filter(AuditLog.organizationId == org_id).all()
    actions = [log.action for log in logs]

    assert "LITERATURE_STUDY_ADDED" in actions
    assert "PRISMA_FLOW_UPDATED" in actions
    assert "LITERATURE_STUDY_DELETED" in actions

    # Verify trusted organizationId binding in DB
    prisma_record = db.query(PrismaFlow).filter(PrismaFlow.projectId == project_id).first()
    assert prisma_record is not None
    assert prisma_record.organizationId == org_id

    db.close()


def test_cross_tenant_write_protection_all_methods():
    db = SessionLocal()
    user_a, org_a = create_test_tenant(db, "owner_a", "org-owner-a", "owner_a@test.com")
    user_b, org_b = create_test_tenant(db, "intruder_b", "org-intruder-b", "intruder_b@test.com")
    project_a = create_test_project(db, user_a, org_a, "proj-owner-a-1")
    project_a_id = project_a.id
    db.close()

    headers_a = get_auth_headers("owner_a", "org-owner-a")
    headers_b = get_auth_headers("intruder_b", "org-intruder-b")

    # Owner creates study
    client.post(
        f"/api/projects/{project_a_id}/literature-synthesis/studies",
        json={"id": "protected-study-1", "author": "Owner Study", "year": 2023, "sampleSize": 50, "effectSize": 0.5, "ciLower": 0.1, "ciUpper": 0.9},
        headers=headers_a
    )

    # Intruder attempts all operations on Owner's project -> Expect 404 on each
    assert client.get(f"/api/projects/{project_a_id}/literature-synthesis", headers=headers_b).status_code == 404
    assert client.post(f"/api/projects/{project_a_id}/literature-synthesis/studies", json={"author": "X", "year": 2024, "sampleSize": 10, "effectSize": 0.1, "ciLower": 0.0, "ciUpper": 0.2}, headers=headers_b).status_code == 404
    assert client.put(f"/api/projects/{project_a_id}/literature-synthesis/sync", json={"studies": []}, headers=headers_b).status_code == 404
    assert client.delete(f"/api/projects/{project_a_id}/literature-synthesis/studies/protected-study-1", headers=headers_b).status_code == 404
    assert client.delete(f"/api/projects/{project_a_id}/literature-synthesis", headers=headers_b).status_code == 404
    assert client.get(f"/api/projects/{project_a_id}/prisma-flow", headers=headers_b).status_code == 404
    assert client.put(f"/api/projects/{project_a_id}/prisma-flow", json={"identified": 10, "duplicates": 0, "excludedScreening": 0, "excludedEligibility": 0}, headers=headers_b).status_code == 404
    assert client.delete(f"/api/projects/{project_a_id}/prisma-flow", headers=headers_b).status_code == 404

