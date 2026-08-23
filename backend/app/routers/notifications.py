import datetime
import logging
import secrets
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..services.tenant_context import get_tenant_context, TenantContext
from ..services.notifications import (
    NotificationCategory,
    EventDispatcher
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["Academic Notifications & Events"])
ws_router = APIRouter(prefix="/ws", tags=["notifications-ws"])


# ─────────────────────────────────────────────────────────────────────────────
# 1. WEBSOCKET REAL-TIME CONNECTION MANAGER (BACKWARDS COMPATIBILITY)
# ─────────────────────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected via WebSocket. Active: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if len(self.active_connections[user_id]) == 0:
                del self.active_connections[user_id]
        logger.info(f"User {user_id} disconnected via WebSocket.")

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send message to {user_id}: {e}")

    async def broadcast(self, message: dict):
        for user_id, connections in self.active_connections.items():
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass


manager = ConnectionManager()


@ws_router.websocket("/notifications/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        manager.disconnect(websocket, user_id)


# ─────────────────────────────────────────────────────────────────────────────
# 2. IN-APP NOTIFICATIONS REST APIS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=schemas.NotificationListResponse, summary="List notifications for current user")
def list_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    category: Optional[str] = Query(None),
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Returns paginated notifications strictly scoped to the authenticated user and active tenant.
    Strictly read-only with zero mutation side-effects.
    Never exposes notifications of other users (Same-Tenant Horizontal Isolation) or other organizations.
    """
    query = db.query(models.Notification).filter(
        models.Notification.organization_id == context.organization.id,
        models.Notification.recipient_user_id == context.user.id
    )

    if unread_only:
        query = query.filter(models.Notification.read_at.is_(None))

    if category:
        query = query.filter(models.Notification.category == category.upper())

    total = query.count()
    unread_count = db.query(models.Notification).filter(
        models.Notification.organization_id == context.organization.id,
        models.Notification.recipient_user_id == context.user.id,
        models.Notification.read_at.is_(None)
    ).count()

    items = query.order_by(models.Notification.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return schemas.NotificationListResponse(
        items=items,
        total=total,
        unread_count=unread_count,
        page=page,
        limit=limit
    )


@router.get("/unread-count", response_model=schemas.UnreadCountResponse, summary="Get unread notification count")
def get_unread_notification_count(
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Computes and returns the exact number of unread notifications for the active user.
    """
    count = db.query(models.Notification).filter(
        models.Notification.organization_id == context.organization.id,
        models.Notification.recipient_user_id == context.user.id,
        models.Notification.read_at.is_(None)
    ).count()

    return schemas.UnreadCountResponse(unread_count=count)


@router.patch("/{id}/read", response_model=schemas.NotificationResponse, summary="Mark notification as read")
def mark_notification_read(
    id: str,
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Marks an in-app notification as read.
    Enforces strict ownership: users can only modify their own notifications.
    """
    notif = db.query(models.Notification).filter(
        models.Notification.id == id
    ).first()

    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الإشعار غير موجود / Notification not found")

    # Multi-tenant and Ownership isolation
    if notif.organization_id != context.organization.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الإشعار غير موجود / Notification not found")

    if notif.recipient_user_id != context.user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="غير مصرح بتعديل إشعار مستخدم آخر / Forbidden")

    if not notif.read_at:
        notif.read_at = datetime.datetime.now(datetime.UTC).isoformat()
        db.commit()
        db.refresh(notif)

    return notif


@router.patch("/{id}/unread", response_model=schemas.NotificationResponse, summary="Mark notification as unread")
def mark_notification_unread(
    id: str,
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Marks an in-app notification as unread.
    """
    notif = db.query(models.Notification).filter(
        models.Notification.id == id
    ).first()

    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الإشعار غير موجود / Notification not found")

    if notif.organization_id != context.organization.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الإشعار غير موجود / Notification not found")

    if notif.recipient_user_id != context.user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="غير مصرح بتعديل إشعار مستخدم آخر / Forbidden")

    if notif.read_at:
        notif.read_at = None
        db.commit()
        db.refresh(notif)

    return notif


@router.post("/read-all", summary="Mark all notifications as read")
def mark_all_notifications_read(
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Marks all notifications of current user as read in the active tenant.
    """
    now_str = datetime.datetime.now(datetime.UTC).isoformat()
    db.query(models.Notification).filter(
        models.Notification.organization_id == context.organization.id,
        models.Notification.recipient_user_id == context.user.id,
        models.Notification.read_at.is_(None)
    ).update({"read_at": now_str}, synchronize_session=False)

    db.commit()
    return {"message": "تم تحديث جميع الإشعارات كمقروءة بنجاح", "updated_at": now_str}


# ─────────────────────────────────────────────────────────────────────────────
# 3. NOTIFICATION PREFERENCES APIS
# ─────────────────────────────────────────────────────────────────────────────

ALL_CATEGORIES = [
    NotificationCategory.PROMOTION.value,
    NotificationCategory.PEER_REVIEW.value,
    NotificationCategory.RESEARCH_WORKFLOW.value,
    NotificationCategory.SYSTEM.value
]


@router.get("/preferences", response_model=schemas.NotificationPreferencesResponse, summary="Get user notification preferences")
def get_notification_preferences(
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Returns the user's notification preferences across all supported categories.
    Defaults to enabled if no customized record exists.
    """
    existing_prefs = db.query(models.NotificationPreference).filter(
        models.NotificationPreference.organization_id == context.organization.id,
        models.NotificationPreference.user_id == context.user.id
    ).all()

    pref_map = {p.category: p for p in existing_prefs}
    result_items: List[schemas.NotificationPreferenceItem] = []

    for cat in ALL_CATEGORIES:
        if cat in pref_map:
            p = pref_map[cat]
            result_items.append(schemas.NotificationPreferenceItem(
                category=p.category,
                in_app_enabled=p.in_app_enabled,
                email_enabled=p.email_enabled,
                updated_at=p.updated_at
            ))
        else:
            result_items.append(schemas.NotificationPreferenceItem(
                category=cat,
                in_app_enabled=True,
                email_enabled=True,
                updated_at=None
            ))

    return schemas.NotificationPreferencesResponse(preferences=result_items)


@router.put("/preferences", response_model=schemas.NotificationPreferencesResponse, summary="Update user notification preferences")
def update_notification_preferences(
    req: schemas.NotificationPreferencesUpdateRequest,
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Updates the authenticated user's notification preferences for the specified categories.
    """
    now_str = datetime.datetime.now(datetime.UTC).isoformat()

    for item in req.preferences:
        cat_clean = item.category.upper()
        if cat_clean not in ALL_CATEGORIES:
            continue

        pref = db.query(models.NotificationPreference).filter(
            models.NotificationPreference.organization_id == context.organization.id,
            models.NotificationPreference.user_id == context.user.id,
            models.NotificationPreference.category == cat_clean
        ).first()

        if pref:
            pref.in_app_enabled = item.in_app_enabled
            pref.email_enabled = item.email_enabled
            pref.updated_at = now_str
        else:
            pref = models.NotificationPreference(
                id=f"pref-{secrets.token_hex(8)}",
                user_id=context.user.id,
                organization_id=context.organization.id,
                category=cat_clean,
                in_app_enabled=item.in_app_enabled,
                email_enabled=item.email_enabled,
                updated_at=now_str
            )
            db.add(pref)

    db.commit()

    # Return full updated list
    return get_notification_preferences(context=context, db=db)


@router.post("/dispatch-outbox", summary="Trigger background outbox processing")
def trigger_outbox_dispatch(
    limit: int = Query(50, ge=1, le=200),
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Administrative / Cron trigger endpoint to process pending transactional outbox events.
    Restricted strictly to Organization Admins and Superadmins.
    """
    if context.role not in ["ORGANIZATION_ADMIN", "OWNER"] and not getattr(context.user, "is_superadmin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="يتطلب صلاحيات مدير المنظومة لتشغيل معالج صندوق الأحداث / Admin role required to dispatch outbox"
        )

    count = EventDispatcher.process_pending_events(db, limit=limit)
    return {"status": "ok", "processed_events": count}
