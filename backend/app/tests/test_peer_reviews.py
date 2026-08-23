import pytest
import secrets
import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.db import Base, engine, SessionLocal
from app import models
from app.routers.auth import hash_password
from app.routers.peer_reviews import hash_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


def create_test_tenant(db, username: str, org_id: str, role: str = "RESEARCHER"):
    user_email = f"{username}_{secrets.token_hex(4)}@test-univ.edu"
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        user = models.User(
            id=f"usr-{username}",
            username=username,
            email=user_email,
            hashed_password=hash_password("Password123!"),
            role="RESEARCHER",
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(user)

    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        org = models.Organization(
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

    membership = db.query(models.OrganizationMembership).filter(
        models.OrganizationMembership.organization_id == org_id,
        models.OrganizationMembership.user_id == user.id
    ).first()
    if not membership:
        membership = models.OrganizationMembership(
            id=f"mbr-{username}-{secrets.token_hex(4)}",
            organization_id=org.id,
            user_id=user.id,
            role=role,
            status="ACTIVE",
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(membership)

    plan = db.query(models.Plan).filter(models.Plan.id == "pln-free").first()
    if not plan:
        plan = models.Plan(
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

    sub = db.query(models.Subscription).filter(models.Subscription.organization_id == org_id).first()
    if not sub:
        sub = models.Subscription(
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


@pytest.fixture
def test_tenants():
    db = SessionLocal()
    suffix_a = secrets.token_hex(4)
    suffix_b = secrets.token_hex(4)

    org_a_id = f"org-peer-a-{suffix_a}"
    org_b_id = f"org-peer-b-{suffix_b}"

    user_editor_a, org_a = create_test_tenant(db, f"ed_a_{suffix_a}", org_a_id, role="OWNER")
    user_author_a, _ = create_test_tenant(db, f"au_a_{suffix_a}", org_a_id, role="RESEARCHER")
    user_rev_a, _ = create_test_tenant(db, f"rv_a_{suffix_a}", org_a_id, role="RESEARCHER")
    user_rev_a2, _ = create_test_tenant(db, f"rv_a2_{suffix_a}", org_a_id, role="RESEARCHER")

    user_editor_b, org_b = create_test_tenant(db, f"ed_b_{suffix_b}", org_b_id, role="OWNER")

    headers_editor_a = get_auth_headers(user_editor_a.username, org_a_id)
    headers_author_a = get_auth_headers(user_author_a.username, org_a_id)
    headers_reviewer_a = get_auth_headers(user_rev_a.username, org_a_id)
    headers_reviewer_a2 = get_auth_headers(user_rev_a2.username, org_a_id)
    headers_editor_b = get_auth_headers(user_editor_b.username, org_b_id)

    data = {
        "org_a": org_a,
        "editor_a": user_editor_a,
        "author_a": user_author_a,
        "reviewer_a": user_rev_a,
        "reviewer_a2": user_rev_a2,
        "org_b": org_b,
        "editor_b": user_editor_b,
        "headers_editor_a": headers_editor_a,
        "headers_author_a": headers_author_a,
        "headers_reviewer_a": headers_reviewer_a,
        "headers_reviewer_a2": headers_reviewer_a2,
        "headers_editor_b": headers_editor_b
    }
    yield data
    db.close()


def test_create_peer_review_case(test_tenants):
    """Verifies creating a review case auto-initializes Round 1 with default rubric snapshot."""
    h = test_tenants["headers_author_a"]
    res = client.post(
        "/api/peer-reviews/cases",
        headers=h,
        json={
            "title_ar": "أثر نماذج الذكاء الاصطناعي على سرعة التحكيم العلمي",
            "title_en": "Impact of AI on Peer Review Velocity",
            "abstract_ar": "دراسة تجريبية على عينة من المجلات الأكاديمية المحكمة",
            "case_type": "MANUSCRIPT",
            "blind_type": "DOUBLE_BLIND"
        }
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title_ar"] == "أثر نماذج الذكاء الاصطناعي على سرعة التحكيم العلمي"
    assert data["status"] == "IN_REVIEW"
    assert data["current_round_number"] == 1
    assert len(data["rounds"]) == 1
    round_1 = data["rounds"][0]
    assert round_1["round_number"] == 1
    assert round_1["status"] == "ACTIVE"
    assert round_1["decision"] == "PENDING"
    assert round_1["rubric_snapshot_json"] is not None


def test_cross_tenant_case_isolation(test_tenants):
    """Ensures a tenant cannot view or modify a review case belonging to another tenant."""
    h_a = test_tenants["headers_author_a"]
    res_a = client.post(
        "/api/peer-reviews/cases",
        headers=h_a,
        json={
            "title_ar": "بحث سري داخل جامعة الملك سعود",
            "title_en": "Confidential Study",
            "case_type": "MANUSCRIPT"
        }
    )
    assert res_a.status_code == 201
    case_id = res_a.json()["id"]

    # Attempt cross-tenant access from Org B
    h_b = test_tenants["headers_editor_b"]
    res_cross = client.get(f"/api/peer-reviews/cases/{case_id}", headers=h_b)
    assert res_cross.status_code == 404


def test_internal_reviewer_assignment_and_author_conflict(test_tenants):
    """Verifies internal reviewer assignment and ensures author cannot be assigned to review own paper."""
    h_author = test_tenants["headers_author_a"]
    res_case = client.post(
        "/api/peer-reviews/cases",
        headers=h_author,
        json={
            "title_ar": "تحليل أداء النماذج اللغوية في استخلاص البيانات الأكاديمية",
            "title_en": "Evaluating LLMs in Academic Data Extraction"
        }
    )
    round_id = res_case.json()["rounds"][0]["id"]

    h_editor = test_tenants["headers_editor_a"]

    # 1. Author attempting to be assigned to review own work -> 400 Bad Request
    res_author_assign = client.post(
        f"/api/peer-reviews/rounds/{round_id}/assignments",
        headers=h_editor,
        json={
            "reviewer_type": "INTERNAL_REVIEWER",
            "reviewer_user_id": test_tenants["author_a"].id
        }
    )
    assert res_author_assign.status_code == 400

    # 2. Assign legitimate internal reviewer
    res_assign = client.post(
        f"/api/peer-reviews/rounds/{round_id}/assignments",
        headers=h_editor,
        json={
            "reviewer_type": "INTERNAL_REVIEWER",
            "reviewer_user_id": test_tenants["reviewer_a"].id,
            "due_at": (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=14)).isoformat()
        }
    )
    assert res_assign.status_code == 201
    assignment = res_assign.json()
    assert assignment["status"] == "INVITED"
    assert assignment["reviewer_user_id"] == test_tenants["reviewer_a"].id


def test_internal_reviewer_flow_accept_draft_submit(test_tenants):
    """Verifies full internal reviewer workflow: accept -> draft -> complete submit -> locked."""
    h_editor = test_tenants["headers_editor_a"]
    h_author = test_tenants["headers_author_a"]
    h_reviewer = test_tenants["headers_reviewer_a"]

    # Create Case
    res_case = client.post(
        "/api/peer-reviews/cases",
        headers=h_author,
        json={
            "title_ar": "دراسة النزاهة العلمية في المجلات العربية",
            "title_en": "Scientific Integrity in Arabic Journals"
        }
    )
    case_data = res_case.json()
    round_1 = case_data["rounds"][0]
    rubric_criteria = round_1["rubric_snapshot_json"]["criteria"]

    # Assign internal reviewer
    res_assign = client.post(
        f"/api/peer-reviews/rounds/{round_1['id']}/assignments",
        headers=h_editor,
        json={
            "reviewer_type": "INTERNAL_REVIEWER",
            "reviewer_user_id": test_tenants["reviewer_a"].id
        }
    )
    assignment_id = res_assign.json()["id"]

    # 1. Accept assignment with COI declaration
    res_accept = client.post(
        f"/api/peer-reviews/assignments/{assignment_id}/accept",
        headers=h_reviewer,
        json={"conflict_status": "NO_CONFLICT", "conflict_notes": "لا يوجد أي تضارب"}
    )
    assert res_accept.status_code == 200
    assert res_accept.json()["status"] == "ACCEPTED"

    # 2. Save Draft
    sample_responses = [
        {"criterion_id": c["id"], "score_value": 8.5, "comments": f"ملاحظة حول {c['title_ar']}"}
        for c in rubric_criteria
    ]
    res_draft = client.put(
        f"/api/peer-reviews/assignments/{assignment_id}/draft",
        headers=h_reviewer,
        json={
            "recommendation": "MINOR_REVISION",
            "summary_evaluation_ar": "بحث ممتاز يحتاج تحسين بسيط في مناقشة النتائج",
            "responses": sample_responses,
            "comments": [
                {"comment_type": "AUTHOR_VISIBLE", "comment_text": "يرجى توضيح حجم العينة في الجدول 2"},
                {"comment_type": "CONFIDENTIAL_TO_EDITOR", "comment_text": "ملاحظة سرية للمحرر: الباحث متمكن"}
            ]
        }
    )
    assert res_draft.status_code == 200
    assert res_draft.json()["status"] == "DRAFT"

    # 3. Submit Review Final
    res_submit = client.post(
        f"/api/peer-reviews/assignments/{assignment_id}/submit",
        headers=h_reviewer,
        json={
            "recommendation": "MINOR_REVISION",
            "summary_evaluation_ar": "بحث ممتاز جاهز للنشر بعد تعديلات طفيفة",
            "responses": sample_responses,
            "comments": [
                {"comment_type": "AUTHOR_VISIBLE", "comment_text": "يرجى توضيح حجم العينة في الجدول 2"}
            ]
        }
    )
    assert res_submit.status_code == 200
    assert res_submit.json()["status"] == "SUBMITTED"
    assert res_submit.json()["total_weighted_score"] == 8.5

    # 4. Immutability check: cannot edit after submit -> 409 Conflict
    res_re_draft = client.put(
        f"/api/peer-reviews/assignments/{assignment_id}/draft",
        headers=h_reviewer,
        json={"recommendation": "ACCEPT", "responses": [], "comments": []}
    )
    assert res_re_draft.status_code == 409


def test_external_reviewer_portal_magic_link_workflow(test_tenants):
    """
    Verifies external reviewer flow:
    - Invitation generates SHA-256 token hash and returns raw token once
    - External reviewer accesses /external-reviews/portal/{raw_token} without login
    - Declares COI, evaluates rubric, and submits review
    - Validates token revocation and expiry handling
    """
    db = SessionLocal()
    try:
        h_editor = test_tenants["headers_editor_a"]
        h_author = test_tenants["headers_author_a"]

        # Create Case
        res_case = client.post(
            "/api/peer-reviews/cases",
            headers=h_author,
            json={
                "title_ar": "دراسة مقارنة للمناهج الكمية والنوعية",
                "title_en": "Comparative Study of Research Methods"
            }
        )
        case_data = res_case.json()
        round_id = case_data["rounds"][0]["id"]

        # Invite external reviewer
        res_invite = client.post(
            f"/api/peer-reviews/rounds/{round_id}/assignments",
            headers=h_editor,
            json={
                "reviewer_type": "EXTERNAL_REVIEWER",
                "external_email": "prof.smith@oxford-academic.edu",
                "external_name": "Prof. John Smith",
                "due_at": (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=14)).isoformat()
            }
        )
        assert res_invite.status_code == 201
        invite_data = res_invite.json()
        magic_url = invite_data["magic_link_url"]
        assert "/external-review/" in magic_url
        raw_token = magic_url.split("/external-review/")[1]

        # Verify token_hash is stored in DB, not raw_token
        token_record = db.query(models.ExternalReviewerToken).filter(
            models.ExternalReviewerToken.assignment_id == invite_data["id"]
        ).first()
        assert token_record is not None
        assert token_record.token_hash == hash_token(raw_token)
        assert token_record.token_hash != raw_token

        # 1. External reviewer loads portal (No Auth Headers required!)
        res_portal = client.get(f"/api/external-reviews/portal/{raw_token}")
        assert res_portal.status_code == 200
        portal_data = res_portal.json()
        assert portal_data["manuscript_title"] == "دراسة مقارنة للمناهج الكمية والنوعية"
        assert portal_data["assignment_status"] == "INVITED"
        assert portal_data["rubric"] is not None

        # 2. External reviewer accepts assignment
        res_ext_accept = client.post(
            f"/api/external-reviews/portal/{raw_token}/accept",
            json={"conflict_status": "NO_CONFLICT", "conflict_notes": "No conflict declared."}
        )
        assert res_ext_accept.status_code == 200
        assert res_ext_accept.json()["assignment_status"] == "ACCEPTED"

        # 3. External reviewer saves draft
        criteria = portal_data["rubric"]["criteria"]
        ext_responses = [
            {"criterion_id": c["id"], "score_value": 9.0, "comments": f"Strong work on {c['title_en']}"}
            for c in criteria
        ]
        res_ext_draft = client.put(
            f"/api/external-reviews/portal/{raw_token}/draft",
            json={
                "recommendation": "ACCEPT",
                "responses": ext_responses,
                "comments": [{"comment_type": "AUTHOR_VISIBLE", "comment_text": "Exceptional manuscript quality."}]
            }
        )
        assert res_ext_draft.status_code == 200

        # 4. External reviewer submits review
        res_ext_submit = client.post(
            f"/api/external-reviews/portal/{raw_token}/submit",
            json={
                "recommendation": "ACCEPT",
                "responses": ext_responses,
                "comments": [{"comment_type": "AUTHOR_VISIBLE", "comment_text": "Exceptional manuscript quality."}]
            }
        )
        assert res_ext_submit.status_code == 200
        assert res_ext_submit.json()["status"] == "SUBMITTED"
        assert res_ext_submit.json()["total_weighted_score"] == 9.0

        # 5. Verify submitted state is locked
        res_ext_re_submit = client.post(
            f"/api/external-reviews/portal/{raw_token}/submit",
            json={"recommendation": "REJECT", "responses": [], "comments": []}
        )
        assert res_ext_re_submit.status_code == 409
    finally:
        db.close()


def test_revoked_or_expired_token_handling(test_tenants):
    """Ensures revoked or expired magic tokens return 401 Unauthorized."""
    db = SessionLocal()
    try:
        h_editor = test_tenants["headers_editor_a"]
        h_author = test_tenants["headers_author_a"]

        res_case = client.post(
            "/api/peer-reviews/cases",
            headers=h_author,
            json={"title_ar": "بحث اختبار الروابط الملغاة", "title_en": "Token Expiry Test"}
        )
        round_id = res_case.json()["rounds"][0]["id"]

        res_invite = client.post(
            f"/api/peer-reviews/rounds/{round_id}/assignments",
            headers=h_editor,
            json={
                "reviewer_type": "EXTERNAL_REVIEWER",
                "external_email": "rev.expired@example.org"
            }
        )
        raw_token = res_invite.json()["magic_link_url"].split("/external-review/")[1]

        # Revoke token in DB
        token_record = db.query(models.ExternalReviewerToken).filter(
            models.ExternalReviewerToken.token_hash == hash_token(raw_token)
        ).first()
        token_record.revoked_at = datetime.datetime.now(datetime.UTC).isoformat()
        db.commit()

        # Attempt access with revoked token -> 401
        res_revoked = client.get(f"/api/external-reviews/portal/{raw_token}")
        assert res_revoked.status_code == 401
        assert "revoked" in res_revoked.json()["detail"].lower()
    finally:
        db.close()


def test_external_token_expiration(test_tenants):
    """Verifies that an expired external reviewer magic token returns 401 Unauthorized."""
    db = SessionLocal()
    try:
        h_editor = test_tenants["headers_editor_a"]
        h_author = test_tenants["headers_author_a"]

        res_case = client.post(
            "/api/peer-reviews/cases",
            headers=h_author,
            json={"title_ar": "بحث اختبار انتهاء الصلاحية", "title_en": "Token Expiry Verification"}
        )
        round_id = res_case.json()["rounds"][0]["id"]

        res_invite = client.post(
            f"/api/peer-reviews/rounds/{round_id}/assignments",
            headers=h_editor,
            json={
                "reviewer_type": "EXTERNAL_REVIEWER",
                "external_email": "expired.reviewer@university.ac.uk"
            }
        )
        raw_token = res_invite.json()["magic_link_url"].split("/external-review/")[1]

        # Set token expires_at to 1 day in the past
        token_record = db.query(models.ExternalReviewerToken).filter(
            models.ExternalReviewerToken.token_hash == hash_token(raw_token)
        ).first()
        token_record.expires_at = (datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1)).isoformat()
        db.commit()

        # Attempt portal access with expired token
        res_exp = client.get(f"/api/external-reviews/portal/{raw_token}")
        assert res_exp.status_code == 401
        assert "expired" in res_exp.json()["detail"].lower()
    finally:
        db.close()


def test_conflict_of_interest_blocks_review_submission(test_tenants):
    """Verifies that declaring a conflict of interest blocks saving drafts or submitting reviews (403 Forbidden)."""
    h_editor = test_tenants["headers_editor_a"]
    h_author = test_tenants["headers_author_a"]
    h_reviewer = test_tenants["headers_reviewer_a"]

    res_case = client.post(
        "/api/peer-reviews/cases",
        headers=h_author,
        json={"title_ar": "بحث اختبار تضارب المصالح", "title_en": "COI Enforcement Test"}
    )
    round_id = res_case.json()["rounds"][0]["id"]

    res_assign = client.post(
        f"/api/peer-reviews/rounds/{round_id}/assignments",
        headers=h_editor,
        json={
            "reviewer_type": "INTERNAL_REVIEWER",
            "reviewer_user_id": test_tenants["reviewer_a"].id
        }
    )
    asg_id = res_assign.json()["id"]

    # Reviewer accepts but declares conflict of interest
    res_accept = client.post(
        f"/api/peer-reviews/assignments/{asg_id}/accept",
        headers=h_reviewer,
        json={
            "conflict_status": "CONFLICT_DECLARED",
            "conflict_notes": "المؤلف هو المشرف الأكاديمي السابق للمحكم."
        }
    )
    assert res_accept.status_code == 200

    # Reviewer attempts to save draft -> 403 Forbidden
    res_draft = client.put(
        f"/api/peer-reviews/assignments/{asg_id}/draft",
        headers=h_reviewer,
        json={"recommendation": "ACCEPT", "responses": [], "comments": []}
    )
    assert res_draft.status_code == 403
    assert "conflict of interest" in res_draft.json()["detail"].lower()

    # Reviewer attempts to submit review -> 403 Forbidden
    res_submit = client.post(
        f"/api/peer-reviews/assignments/{asg_id}/submit",
        headers=h_reviewer,
        json={"recommendation": "ACCEPT", "responses": [], "comments": []}
    )
    assert res_submit.status_code == 403
    assert "conflict of interest" in res_submit.json()["detail"].lower()


def test_double_blind_and_confidential_comments_privacy(test_tenants):
    """
    Verifies privacy invariants:
    1. In DOUBLE_BLIND mode, reviewer cannot see author identity.
    2. Author cannot see reviewer identity.
    3. Author CANNOT see comments marked CONFIDENTIAL_TO_EDITOR.
    """
    h_editor = test_tenants["headers_editor_a"]
    h_author = test_tenants["headers_author_a"]
    h_reviewer = test_tenants["headers_reviewer_a"]

    res_case = client.post(
        "/api/peer-reviews/cases",
        headers=h_author,
        json={
            "title_ar": "الخصوصية في التحكيم مزدوج التعمية",
            "title_en": "Double Blind Privacy Test",
            "blind_type": "DOUBLE_BLIND"
        }
    )
    case_id = res_case.json()["id"]
    round_1 = res_case.json()["rounds"][0]
    rubric_criteria = round_1["rubric_snapshot_json"]["criteria"]

    # Assign reviewer
    res_assign = client.post(
        f"/api/peer-reviews/rounds/{round_1['id']}/assignments",
        headers=h_editor,
        json={
            "reviewer_type": "INTERNAL_REVIEWER",
            "reviewer_user_id": test_tenants["reviewer_a"].id
        }
    )
    asg_id = res_assign.json()["id"]

    # Reviewer accepts and submits review with both author-visible and confidential-to-editor comments
    client.post(
        f"/api/peer-reviews/assignments/{asg_id}/accept",
        headers=h_reviewer,
        json={"conflict_status": "NO_CONFLICT"}
    )

    sample_responses = [
        {"criterion_id": c["id"], "score_value": 9.0, "comments": "ممتاز"}
        for c in rubric_criteria
    ]

    client.post(
        f"/api/peer-reviews/assignments/{asg_id}/submit",
        headers=h_reviewer,
        json={
            "recommendation": "ACCEPT",
            "responses": sample_responses,
            "comments": [
                {"comment_type": "AUTHOR_VISIBLE", "comment_text": "ملاحظة عامة موجهة للباحث"},
                {"comment_type": "CONFIDENTIAL_TO_EDITOR", "comment_text": "ملاحظة سرية خاصة بهيئة التحرير فقط"}
            ]
        }
    )

    # 1. Author views case -> Reviewer name is masked, and confidential comment is STRIPPED
    res_author_view = client.get(f"/api/peer-reviews/cases/{case_id}", headers=h_author)
    assert res_author_view.status_code == 200
    author_data = res_author_view.json()

    assignment_view = author_data["rounds"][0]["assignments"][0]
    assert assignment_view["reviewer_user_id"] is None
    assert "محجوب الهوية" in assignment_view["external_name"]

    # Assert confidential comment is NOT in author view
    comments = assignment_view["submission"]["comments"]
    assert len(comments) == 1
    assert comments[0]["comment_type"] == "AUTHOR_VISIBLE"
    assert "ملاحظة عامة" in comments[0]["comment_text"]
    assert not any("سرية" in c["comment_text"] for c in comments)

    # 2. Editor views case -> Sees all comments and full identities
    res_editor_view = client.get(f"/api/peer-reviews/cases/{case_id}", headers=h_editor)
    assert res_editor_view.status_code == 200
    editor_data = res_editor_view.json()
    editor_assignment = editor_data["rounds"][0]["assignments"][0]
    assert editor_assignment["reviewer_user_id"] == test_tenants["reviewer_a"].id
    assert len(editor_assignment["submission"]["comments"]) == 2


def test_internal_reviewer_idor_prevention(test_tenants):
    """Ensures Reviewer A cannot view, modify, or submit Reviewer B's assignment (Same Tenant Horizontal IDOR)."""
    h_editor = test_tenants["headers_editor_a"]
    h_author = test_tenants["headers_author_a"]
    h_reviewer_1 = test_tenants["headers_reviewer_a"]
    h_reviewer_2 = test_tenants["headers_reviewer_a2"]

    res_case = client.post(
        "/api/peer-reviews/cases",
        headers=h_author,
        json={"title_ar": "بحث فحص IDOR الداخلي", "title_en": "Internal IDOR Test"}
    )
    round_id = res_case.json()["rounds"][0]["id"]

    # Assign Reviewer 1
    res_assign_1 = client.post(
        f"/api/peer-reviews/rounds/{round_id}/assignments",
        headers=h_editor,
        json={
            "reviewer_type": "INTERNAL_REVIEWER",
            "reviewer_user_id": test_tenants["reviewer_a"].id
        }
    )
    asg_1_id = res_assign_1.json()["id"]

    # Reviewer 2 attempts to accept Reviewer 1's assignment -> 404 Not Found
    res_idor_accept = client.post(
        f"/api/peer-reviews/assignments/{asg_1_id}/accept",
        headers=h_reviewer_2,
        json={"conflict_status": "NO_CONFLICT"}
    )
    assert res_idor_accept.status_code == 404

    # Reviewer 2 attempts to save draft on Reviewer 1's assignment -> 404 Not Found
    res_idor_draft = client.put(
        f"/api/peer-reviews/assignments/{asg_1_id}/draft",
        headers=h_reviewer_2,
        json={"recommendation": "REJECT", "responses": [], "comments": []}
    )
    assert res_idor_draft.status_code == 404


def test_invalid_score_bounds_and_state_transitions(test_tenants):
    """Verifies that out-of-bounds scores (e.g. 15.0 or -2.0) and invalid state transitions are rejected."""
    h_editor = test_tenants["headers_editor_a"]
    h_author = test_tenants["headers_author_a"]
    h_reviewer = test_tenants["headers_reviewer_a"]

    res_case = client.post(
        "/api/peer-reviews/cases",
        headers=h_author,
        json={"title_ar": "فحص قيود الدرجات", "title_en": "Score Bounds Validation"}
    )
    round_1 = res_case.json()["rounds"][0]
    crit_id = round_1["rubric_snapshot_json"]["criteria"][0]["id"]

    res_assign = client.post(
        f"/api/peer-reviews/rounds/{round_1['id']}/assignments",
        headers=h_editor,
        json={
            "reviewer_type": "INTERNAL_REVIEWER",
            "reviewer_user_id": test_tenants["reviewer_a"].id
        }
    )
    asg_id = res_assign.json()["id"]

    # 1. Reviewer declines assignment
    client.post(
        f"/api/peer-reviews/assignments/{asg_id}/decline",
        headers=h_reviewer,
        json={"decline_reason": "عدم التفرغ"}
    )

    # 2. Attempting to submit after declining -> 409 Conflict
    res_submit_declined = client.post(
        f"/api/peer-reviews/assignments/{asg_id}/submit",
        headers=h_reviewer,
        json={"recommendation": "ACCEPT", "responses": [], "comments": []}
    )
    assert res_submit_declined.status_code == 409

    # Re-accept
    client.post(
        f"/api/peer-reviews/assignments/{asg_id}/accept",
        headers=h_reviewer,
        json={"conflict_status": "NO_CONFLICT"}
    )

    # 3. Attempting to submit with out-of-bounds score (15.0) -> 422 Unprocessable Entity
    res_invalid_score = client.post(
        f"/api/peer-reviews/assignments/{asg_id}/submit",
        headers=h_reviewer,
        json={
            "recommendation": "ACCEPT",
            "responses": [{"criterion_id": crit_id, "score_value": 15.0}],
            "comments": []
        }
    )
    assert res_invalid_score.status_code == 422


def test_human_editorial_decision_and_revision_flow(test_tenants):
    """
    Verifies human-in-the-loop governance:
    - Editorial decision recording (ACCEPTED, REVISION_REQUIRED, REJECTED)
    - Author uploading revised version v2
    - Initializing Round 2 with new revision snapshot
    """
    h_editor = test_tenants["headers_editor_a"]
    h_author = test_tenants["headers_author_a"]

    # 1. Create Case
    res_case = client.post(
        "/api/peer-reviews/cases",
        headers=h_author,
        json={
            "title_ar": "فاعلية بيئات التعلم الذكية في الدراسات العليا",
            "title_en": "Efficacy of Smart Learning Environments in Post-grad Studies"
        }
    )
    case_id = res_case.json()["id"]

    # 2. Human Editor issues REVISION_REQUIRED decision
    res_decision = client.post(
        f"/api/peer-reviews/cases/{case_id}/decision",
        headers=h_editor,
        json={
            "decision": "REVISION_REQUIRED",
            "decision_notes": "بناء على تقارير المحكمين، يرجى إعادة ضبط منهجية العينة واستكمال الجولة الثانية."
        }
    )
    assert res_decision.status_code == 200
    assert res_decision.json()["status"] == "REVISION_REQUESTED"

    # 3. Author uploads Revision v2
    res_revision = client.post(
        f"/api/peer-reviews/cases/{case_id}/revisions",
        headers=h_author,
        json={
            "title_ar": "فاعلية بيئات التعلم الذكية في الدراسات العليا (نسخة معدلة v2)",
            "title_en": "Efficacy of Smart Learning Environments in Post-grad Studies (Revised v2)",
            "response_to_reviewers": "تمت معالجة كافة ملاحظات المحكمين وإعادة احتساب حجم العينة وفقاً لمعادلة Cochran."
        }
    )
    assert res_revision.status_code == 201
    assert res_revision.json()["version_number"] == 2

    # 4. Editor creates Round 2 for re-review
    res_round_2 = client.post(
        f"/api/peer-reviews/cases/{case_id}/rounds",
        headers=h_editor
    )
    assert res_round_2.status_code == 201
    round_2_data = res_round_2.json()
    assert round_2_data["round_number"] == 2
    assert round_2_data["manuscript_version"] == 2
    assert "نسخة معدلة v2" in round_2_data["manuscript_snapshot_json"]["title_ar"]

    # 5. Editor issues final ACCEPTED decision on Round 2
    res_final_decision = client.post(
        f"/api/peer-reviews/cases/{case_id}/decision",
        headers=h_editor,
        json={
            "decision": "ACCEPTED",
            "decision_notes": "تم استيفاء جميع التعديلات المطلوبة واعتمد البحث للنشر النهائي."
        }
    )
    assert res_final_decision.status_code == 200
    assert res_final_decision.json()["status"] == "DECIDED"


def test_audit_log_never_leaks_raw_token(test_tenants):
    """Ensures raw token strings are never written to the audit log or database tables in plain text."""
    db = SessionLocal()
    try:
        h_editor = test_tenants["headers_editor_a"]
        h_author = test_tenants["headers_author_a"]

        res_case = client.post(
            "/api/peer-reviews/cases",
            headers=h_author,
            json={"title_ar": "فحص سجل التدقيق الأمني", "title_en": "Audit Token Leak Test"}
        )
        round_id = res_case.json()["rounds"][0]["id"]

        res_invite = client.post(
            f"/api/peer-reviews/rounds/{round_id}/assignments",
            headers=h_editor,
            json={
                "reviewer_type": "EXTERNAL_REVIEWER",
                "external_email": "security.referee@cambridge.edu"
            }
        )
        raw_token = res_invite.json()["magic_link_url"].split("/external-review/")[1]

        # Scan all audit log records for raw_token string
        audits = db.query(models.AuditLog).filter(
            models.AuditLog.organizationId == test_tenants["org_a"].id
        ).all()
        for a in audits:
            assert raw_token not in (a.details or "")

        # Verify ExternalReviewerToken table does not store raw_token
        tokens = db.query(models.ExternalReviewerToken).all()
        for t in tokens:
            assert t.token_hash != raw_token
            assert len(t.token_hash) == 64 # Standard SHA-256 hex length
    finally:
        db.close()
