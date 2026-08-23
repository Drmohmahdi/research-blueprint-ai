import pytest
import secrets
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db import Base, engine, SessionLocal
from app import models
from app.routers.auth import hash_password
from app.services.notifications import (
    OutboxService,
    EventDispatcher,
    WorkflowEventType,
    AggregateType,
    EventPayload,
    DeliveryStatus,
    EventStatus
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


def create_test_tenant(db: Session, username_prefix: str, role: str = "RESEARCHER"):
    suffix = secrets.token_hex(4)
    username = f"{username_prefix}_{suffix}"
    org_id = f"org_{username_prefix}_{suffix}"
    user_email = f"{username}@test-univ.edu"

    user = models.User(
        id=f"usr-{username}",
        username=username,
        email=user_email,
        hashed_password=hash_password("Password123!"),
        role="RESEARCHER",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(user)

    org = models.Organization(
        id=org_id,
        name=f"University {org_id}",
        slug=f"slug-{org_id}",
        organization_type="UNIVERSITY",
        status="ACTIVE",
        owner_user_id=user.id,
        default_language="ar",
        data_region="sa",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(org)

    membership = models.OrganizationMembership(
        id=f"mbr-{username}",
        organization_id=org.id,
        user_id=user.id,
        role=role,
        status="ACTIVE",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(membership)

    db.commit()
    return user, org


def add_tenant_member(db: Session, org_id: str, username_prefix: str, role: str = "RESEARCHER"):
    suffix = secrets.token_hex(4)
    username = f"{username_prefix}_{suffix}"
    user_email = f"{username}@test-univ.edu"

    user = models.User(
        id=f"usr-{username}",
        username=username,
        email=user_email,
        hashed_password=hash_password("Password123!"),
        role="RESEARCHER",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(user)

    membership = models.OrganizationMembership(
        id=f"mbr-{username}",
        organization_id=org_id,
        user_id=user.id,
        role=role,
        status="ACTIVE",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(membership)
    db.commit()
    return user


def get_auth_headers(username: str, org_id: str):
    login_res = client.post("/api/auth/login", json={"username": username, "password": "Password123!"})
    token = login_res.json()["token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-Organization-ID": org_id
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. TRANSACTIONAL OUTBOX & ATOMICITY TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_transactional_rollback_leaves_no_orphan_event():
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_notif_atom_1", "RESEARCHER")
    key = f"key-rollback-{secrets.token_hex(4)}"

    # Start transaction, record event, but explicitly rollback
    try:
        OutboxService.record_event(
            db=db,
            organization_id=org.id,
            event_type=WorkflowEventType.PROJECT_STATUS_CHANGED,
            aggregate_type=AggregateType.RESEARCH_PROJECT,
            aggregate_id=f"proj-fake-{secrets.token_hex(4)}",
            actor_user_id=user.id,
            payload=EventPayload(
                title_ar="تغيير حالة",
                title_en="Status Change",
                message_ar="رسالة تجريبية",
                message_en="Test message"
            ),
            idempotency_key=key
        )
        # Simulate a domain failure
        raise RuntimeError("Simulated domain operation failure")
    except RuntimeError:
        db.rollback()

    # Verify event does NOT exist in DB
    evt = db.query(models.WorkflowEvent).filter(
        models.WorkflowEvent.idempotency_key == key
    ).first()
    assert evt is None
    db.close()


def test_successful_domain_operation_persists_event():
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_notif_atom_2", "RESEARCHER")
    key = f"key-success-{secrets.token_hex(4)}"

    evt = OutboxService.record_event(
        db=db,
        organization_id=org.id,
        event_type=WorkflowEventType.PROJECT_STATUS_CHANGED,
        aggregate_type=AggregateType.RESEARCH_PROJECT,
        aggregate_id=f"proj-fake-{secrets.token_hex(4)}",
        actor_user_id=user.id,
        payload=EventPayload(
            title_ar="تغيير حالة المشروع",
            title_en="Project Status Changed",
            message_ar="تم تغيير حالة المشروع بنجاح.",
            message_en="Project status changed successfully."
        ),
        idempotency_key=key
    )
    db.commit()

    saved = db.query(models.WorkflowEvent).filter(
        models.WorkflowEvent.idempotency_key == key
    ).first()
    assert saved is not None
    assert saved.id == evt.id
    assert saved.status == EventStatus.PENDING.value
    db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 2. IDEMPOTENCY & DEDUPLICATION TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_event_idempotency_prevents_duplicate_events():
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_notif_idem_1", "RESEARCHER")
    key = f"key-idem-{secrets.token_hex(6)}"

    evt1 = OutboxService.record_event(
        db=db,
        organization_id=org.id,
        event_type=WorkflowEventType.PROJECT_STATUS_CHANGED,
        aggregate_type=AggregateType.RESEARCH_PROJECT,
        aggregate_id=f"proj-{secrets.token_hex(4)}",
        actor_user_id=user.id,
        payload=EventPayload(title_ar="أ", title_en="A", message_ar="أ", message_en="A"),
        idempotency_key=key
    )
    db.commit()

    # Attempt to record same event second time
    evt2 = OutboxService.record_event(
        db=db,
        organization_id=org.id,
        event_type=WorkflowEventType.PROJECT_STATUS_CHANGED,
        aggregate_type=AggregateType.RESEARCH_PROJECT,
        aggregate_id=f"proj-{secrets.token_hex(4)}",
        actor_user_id=user.id,
        payload=EventPayload(title_ar="أ", title_en="A", message_ar="أ", message_en="A"),
        idempotency_key=key
    )
    db.commit()

    assert evt1.id == evt2.id
    count = db.query(models.WorkflowEvent).filter(models.WorkflowEvent.idempotency_key == key).count()
    assert count == 1
    db.close()


def test_event_dispatcher_deduplicates_in_app_notifications():
    db = SessionLocal()
    owner, org = create_test_tenant(db, "usr_proj_owner", "RESEARCHER")
    commenter = add_tenant_member(db, org.id, "usr_commenter", "RESEARCHER")

    # Create dummy project
    proj_id = f"proj-dedup-{secrets.token_hex(4)}"
    proj = models.ResearchProject(
        id=proj_id,
        organizationId=org.id,
        userId=owner.id,
        titleAr="مشروع تدقيق الإشعارات",
        titleEn="Notification Audit Project",
        sampleSettings={"marginOfError": 0.05}
    )
    db.add(proj)
    db.commit()

    # Record comment event
    evt_key = f"key-dedup-{secrets.token_hex(6)}"
    evt = OutboxService.record_event(
        db=db,
        organization_id=org.id,
        event_type=WorkflowEventType.PROJECT_COMMENT_ADDED,
        aggregate_type=AggregateType.RESEARCH_PROJECT,
        aggregate_id=proj.id,
        actor_user_id=commenter.id,
        payload=EventPayload(
            title_ar="تعليق جديد",
            title_en="New Comment",
            message_ar="أضاف الباحث تعليقاً",
            message_en="Researcher added comment",
            target_type="RESEARCH_PROJECT",
            target_id=proj.id
        ),
        idempotency_key=evt_key
    )
    db.commit()

    # Process event 1st time
    res1 = EventDispatcher.process_event(db, evt)
    assert res1 is True

    # Process event 2nd time (simulate retry)
    res2 = EventDispatcher.process_event(db, evt)
    assert res2 is True

    # Verify exactly 1 notification was created for owner
    notifs = db.query(models.Notification).filter(
        models.Notification.workflow_event_id == evt.id,
        models.Notification.recipient_user_id == owner.id
    ).all()
    assert len(notifs) == 1
    db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 3. MULTI-TENANT & SAME-TENANT HORIZONTAL ISOLATION TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_cross_tenant_isolation_notifications():
    db = SessionLocal()
    user_a, org_a = create_test_tenant(db, "usr_ten_a", "RESEARCHER")
    user_b, org_b = create_test_tenant(db, "usr_ten_b", "RESEARCHER")
    username_b = user_b.username
    org_b_id = org_b.id

    notif_id = f"notif-org-a-{secrets.token_hex(4)}"
    notif_a = models.Notification(
        id=notif_id,
        organization_id=org_a.id,
        recipient_user_id=user_a.id,
        category="SYSTEM",
        title_ar="إشعار مؤسسة أ",
        title_en="Org A Notice",
        message_ar="بيانات سرية لمؤسسة أ",
        message_en="Secret Org A data",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(notif_a)
    db.commit()
    db.close()

    headers_b = get_auth_headers(username_b, org_b_id)

    # User B lists notifications -> cannot see notif_a
    res_list = client.get("/api/notifications", headers=headers_b)
    assert res_list.status_code == 200
    assert not any(n["id"] == notif_id for n in res_list.json()["items"])

    # User B tries to mark read notif_a -> 404
    res_read = client.patch(f"/api/notifications/{notif_id}/read", headers=headers_b)
    assert res_read.status_code == 404


def test_same_tenant_horizontal_isolation_notifications():
    db = SessionLocal()
    user_a, org = create_test_tenant(db, "usr_alice", "RESEARCHER")
    user_b = add_tenant_member(db, org.id, "usr_bob", "RESEARCHER")
    username_b = user_b.username
    org_id = org.id

    notif_id = f"notif-alice-{secrets.token_hex(4)}"
    notif_a = models.Notification(
        id=notif_id,
        organization_id=org.id,
        recipient_user_id=user_a.id,
        category="PROMOTION",
        title_ar="إشعار أليس",
        title_en="Alice Notice",
        message_ar="خاص بأليس",
        message_en="Alice private",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(notif_a)
    db.commit()
    db.close()

    headers_bob = get_auth_headers(username_b, org_id)

    # Bob tries to access Alice's notification in same tenant -> 403 Forbidden
    res_read = client.patch(f"/api/notifications/{notif_id}/read", headers=headers_bob)
    assert res_read.status_code == 403

    res_unread = client.patch(f"/api/notifications/{notif_id}/unread", headers=headers_bob)
    assert res_unread.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# 4. NOTIFICATION APIS & READ/UNREAD STATE LIFECYCLE
# ─────────────────────────────────────────────────────────────────────────────

def test_notification_listing_pagination_and_read_state():
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_paging", "RESEARCHER")
    username = user.username
    org_id = org.id

    # Seed 25 notifications
    first_notif_id = ""
    for i in range(25):
        nid = f"notif-page-{i}-{secrets.token_hex(3)}"
        if i == 0:
            first_notif_id = nid
        notif = models.Notification(
            id=nid,
            organization_id=org.id,
            recipient_user_id=user.id,
            category="RESEARCH_WORKFLOW",
            title_ar=f"إشعار رقم {i}",
            title_en=f"Notice #{i}",
            message_ar=f"نص الإشعار {i}",
            message_en=f"Notice content {i}",
            read_at=None,
            created_at=f"2026-08-23T00:{i:02d}:00Z"
        )
        db.add(notif)
    db.commit()
    db.close()

    headers = get_auth_headers(username, org_id)

    # 1. Unread count check
    res_count = client.get("/api/notifications/unread-count", headers=headers)
    assert res_count.status_code == 200
    assert res_count.json()["unread_count"] == 25

    # 2. Pagination check (Page 1)
    res_p1 = client.get("/api/notifications?page=1&limit=10", headers=headers)
    assert res_p1.status_code == 200
    data_p1 = res_p1.json()
    assert len(data_p1["items"]) == 10
    assert data_p1["total"] == 25
    assert data_p1["unread_count"] == 25

    # 3. Mark single notification read
    res_mark = client.patch(f"/api/notifications/{first_notif_id}/read", headers=headers)
    assert res_mark.status_code == 200
    assert res_mark.json()["read_at"] is not None

    res_count2 = client.get("/api/notifications/unread-count", headers=headers)
    assert res_count2.json()["unread_count"] == 24

    # 4. Mark unread
    res_unmark = client.patch(f"/api/notifications/{first_notif_id}/unread", headers=headers)
    assert res_unmark.status_code == 200
    assert res_unmark.json()["read_at"] is None

    res_count3 = client.get("/api/notifications/unread-count", headers=headers)
    assert res_count3.json()["unread_count"] == 25

    # 5. Read all
    res_all = client.post("/api/notifications/read-all", headers=headers)
    assert res_all.status_code == 200

    res_count4 = client.get("/api/notifications/unread-count", headers=headers)
    assert res_count4.json()["unread_count"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# 5. PREFERENCES & MANDATORY NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────────────────

def test_category_preferences_and_mandatory_override():
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_prefs_u", "RESEARCHER")
    admin = add_tenant_member(db, org.id, "usr_prefs_adm", "ORGANIZATION_ADMIN")
    username = user.username
    org_id = org.id
    user_id = user.id
    admin_id = admin.id
    db.close()

    headers = get_auth_headers(username, org_id)

    # 1. Fetch default preferences
    res_get = client.get("/api/notifications/preferences", headers=headers)
    assert res_get.status_code == 200
    prefs = res_get.json()["preferences"]
    assert len(prefs) == 4

    # 2. Disable In-App & Email for RESEARCH_WORKFLOW
    update_payload = {
        "preferences": [
            {"category": "RESEARCH_WORKFLOW", "in_app_enabled": False, "email_enabled": False},
            {"category": "PROMOTION", "in_app_enabled": False, "email_enabled": False}
        ]
    }
    res_put = client.put("/api/notifications/preferences", json=update_payload, headers=headers)
    assert res_put.status_code == 200

    db = SessionLocal()
    # 3. Create a project and comment (Optional category) -> should be skipped for In-App by preference
    proj = models.ResearchProject(
        id=f"proj-prefs-{secrets.token_hex(4)}",
        organizationId=org_id,
        userId=user_id,
        titleAr="مشروع التفضيلات",
        titleEn="Preferences Project",
        sampleSettings={"marginOfError": 0.05}
    )
    db.add(proj)
    db.commit()

    evt_optional = OutboxService.record_event(
        db=db,
        organization_id=org_id,
        event_type=WorkflowEventType.PROJECT_COMMENT_ADDED,
        aggregate_type=AggregateType.RESEARCH_PROJECT,
        aggregate_id=proj.id,
        actor_user_id=admin_id,
        payload=EventPayload(title_ar="تعليق", title_en="Comment", message_ar="تعليق", message_en="Comment"),
        idempotency_key=f"key-opt-{secrets.token_hex(4)}"
    )
    db.commit()

    EventDispatcher.process_event(db, evt_optional)

    # In-App notification should NOT exist for user because in_app_enabled=False for RESEARCH_WORKFLOW
    notif_opt = db.query(models.Notification).filter(
        models.Notification.workflow_event_id == evt_optional.id,
        models.Notification.recipient_user_id == user_id
    ).first()
    assert notif_opt is None

    # 4. Mandatory Promotion Event -> MUST BE DELIVERED in-app despite in_app_enabled=False
    app = models.PromotionApplication(
        id=f"app-prefs-{secrets.token_hex(4)}",
        organization_id=org_id,
        user_id=user_id,
        policy_id="pol-dummy",
        policy_version=1,
        target_rank="PROFESSOR",
        current_rank="ASSOCIATE_PROFESSOR",
        status="COMPLETED",
        readiness_percentage=100,
        total_calculated_points=80.0,
        created_at="2026-08-23T00:00:00Z",
        updated_at="2026-08-23T00:00:00Z"
    )
    db.add(app)
    db.commit()

    evt_mandatory = OutboxService.record_event(
        db=db,
        organization_id=org_id,
        event_type=WorkflowEventType.PROMOTION_PROCESS_COMPLETED,
        aggregate_type=AggregateType.PROMOTION_APPLICATION,
        aggregate_id=app.id,
        actor_user_id=admin_id,
        payload=EventPayload(
            title_ar="اكتمال الترقية",
            title_en="Promotion Completed",
            message_ar="تم اعتماد قرار الترقية",
            message_en="Promotion approved"
        ),
        idempotency_key=f"key-mand-{secrets.token_hex(4)}"
    )
    db.commit()

    EventDispatcher.process_event(db, evt_mandatory)

    # In-App notification MUST exist because it is WORKFLOW_REQUIRED
    notif_mand = db.query(models.Notification).filter(
        models.Notification.workflow_event_id == evt_mandatory.id,
        models.Notification.recipient_user_id == user_id
    ).first()
    assert notif_mand is not None
    db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 6. DOMAIN INTEGRATIONS & PRIVACY TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_peer_review_blind_and_confidential_comments_protection():
    db = SessionLocal()
    author, org = create_test_tenant(db, "usr_pr_auth", "RESEARCHER")
    editor = add_tenant_member(db, org.id, "usr_pr_ed", "ORGANIZATION_ADMIN")
    reviewer = add_tenant_member(db, org.id, "usr_pr_rev", "RESEARCHER")
    editor_id = editor.id
    author_id = author.id
    reviewer_id = reviewer.id
    org_id = org.id

    # Create double-blind review case
    case_id = f"case-notif-{secrets.token_hex(4)}"
    case = models.PeerReviewCase(
        id=case_id,
        organization_id=org_id,
        owner_user_id=author_id,
        title_ar="بحث التحكيم السري",
        title_en="Double Blind Study",
        case_type="MANUSCRIPT",
        blind_type="DOUBLE_BLIND",
        status="IN_REVIEW",
        current_round_number=1,
        created_at="2026-08-23T00:00:00Z",
        updated_at="2026-08-23T00:00:00Z"
    )
    db.add(case)
    db.commit()

    # Reviewer submits review event
    evt_key = f"key-pr-sub-{secrets.token_hex(6)}"
    evt = OutboxService.record_event(
        db=db,
        organization_id=org_id,
        event_type=WorkflowEventType.REVIEW_SUBMITTED,
        aggregate_type=AggregateType.PEER_REVIEW_CASE,
        aggregate_id=case.id,
        actor_user_id=reviewer_id,
        payload=EventPayload(
            title_ar="اكتمال تقرير تحكيم",
            title_en="Review Submitted",
            message_ar="قام المحكم بإيداع تقرير التحكيم",
            message_en="Referee submitted report",
            meta={"recommendation": "ACCEPT"}
        ),
        idempotency_key=evt_key
    )
    db.commit()

    EventDispatcher.process_event(db, evt)

    # 1. Editor must receive notification
    notif_ed = db.query(models.Notification).filter(
        models.Notification.workflow_event_id == evt.id,
        models.Notification.recipient_user_id == editor_id
    ).first()
    assert notif_ed is not None

    # 2. Check privacy: reviewer secret strings must not leak
    for n in db.query(models.Notification).filter(models.Notification.workflow_event_id == evt.id).all():
        assert "SECRET_REVIEWER_NAME" not in n.message_ar
        assert "CONFIDENTIAL_TO_EDITOR" not in n.message_ar

    db.close()


def test_email_adapter_reports_not_configured_honestly():
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_em_hon", "RESEARCHER")
    admin = add_tenant_member(db, org.id, "usr_em_adm", "ORGANIZATION_ADMIN")
    admin_id = admin.id
    user_id = user.id
    org_id = org.id

    proj_id = f"proj-email-{secrets.token_hex(4)}"
    proj = models.ResearchProject(
        id=proj_id,
        organizationId=org_id,
        userId=user_id,
        titleAr="مشروع البريد الصادق",
        titleEn="Honest Email Project",
        sampleSettings={"marginOfError": 0.05}
    )
    db.add(proj)
    db.commit()

    evt_key = f"key-em-hon-{secrets.token_hex(6)}"
    evt = OutboxService.record_event(
        db=db,
        organization_id=org_id,
        event_type=WorkflowEventType.PROJECT_COMMENT_ADDED,
        aggregate_type=AggregateType.RESEARCH_PROJECT,
        aggregate_id=proj.id,
        actor_user_id=admin_id,
        payload=EventPayload(
            title_ar="تعليق بريدي",
            title_en="Email Comment",
            message_ar="نص التعليق",
            message_en="Comment text"
        ),
        idempotency_key=evt_key
    )
    db.commit()

    EventDispatcher.process_event(db, evt)

    # Check Email Delivery record in DB
    deliv = db.query(models.NotificationDelivery).filter(
        models.NotificationDelivery.workflow_event_id == evt.id,
        models.NotificationDelivery.channel == "EMAIL"
    ).first()

    assert deliv is not None
    # Strictly NOT_CONFIGURED, never fake success!
    assert deliv.status == DeliveryStatus.NOT_CONFIGURED.value
    assert deliv.failure_code == "PROVIDER_NOT_CONFIGURED"
    db.close()


def test_promotion_application_submit_and_review_events_integration():
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_pevt_u", "RESEARCHER")
    admin = add_tenant_member(db, org.id, "usr_pevt_adm", "ORGANIZATION_ADMIN")
    username_user = user.username
    username_admin = admin.username
    org_id = org.id

    pol_id = f"pol-prom-{secrets.token_hex(4)}"
    pol = models.PromotionPolicy(
        id=pol_id,
        organization_id=org_id,
        name_ar="لائحة أحداث الترقية",
        name_en="Promotion Events Policy",
        version=1,
        target_rank="PROFESSOR",
        status="ACTIVE",
        created_at="2026-08-23T00:00:00Z",
        updated_at="2026-08-23T00:00:00Z"
    )
    db.add(pol)

    app_id = f"app-prom-{secrets.token_hex(4)}"
    app = models.PromotionApplication(
        id=app_id,
        organization_id=org_id,
        user_id=user.id,
        policy_id=pol.id,
        policy_version=1,
        target_rank="PROFESSOR",
        current_rank="ASSOCIATE_PROFESSOR",
        status="DRAFT",
        created_at="2026-08-23T00:00:00Z",
        updated_at="2026-08-23T00:00:00Z"
    )
    db.add(app)
    db.commit()
    db.close()

    headers_user = get_auth_headers(username_user, org_id)
    headers_admin = get_auth_headers(username_admin, org_id)

    # 1. Submit promotion application
    res_sub = client.post(f"/api/promotions/applications/{app_id}/submit", headers=headers_user)
    assert res_sub.status_code == 200
    assert res_sub.json()["status"] == "SUBMITTED"

    # Admin dispatches outbox
    res_disp = client.post("/api/notifications/dispatch-outbox", headers=headers_admin)
    assert res_disp.status_code == 200

    # Verify event and notification created for admin
    res_admin_notifs = client.get("/api/notifications", headers=headers_admin)
    assert res_admin_notifs.status_code == 200
    assert any(n["category"] == "PROMOTION" for n in res_admin_notifs.json()["items"])

    # 2. Record committee review
    res_rev = client.post(f"/api/promotions/applications/{app_id}/review", json={
        "decision": "APPROVED",
        "notes": "ملف مكتمل ومستوف للشروط"
    }, headers=headers_admin)
    assert res_rev.status_code == 200
    assert res_rev.json()["status"] == "COMPLETED"

    # Admin dispatches outbox
    res_disp2 = client.post("/api/notifications/dispatch-outbox", headers=headers_admin)
    assert res_disp2.status_code == 200

    # Verify applicant received completion notification
    res_user_notifs = client.get("/api/notifications", headers=headers_user)
    assert res_user_notifs.status_code == 200
    assert any(n["category"] == "PROMOTION" for n in res_user_notifs.json()["items"])
