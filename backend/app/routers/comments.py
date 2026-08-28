from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import uuid
from datetime import datetime, timezone

from ..db import get_db
from ..models import ProjectComment, ResearchProject
from ..services.tenant_context import get_tenant_context, TenantContext
from ..services.sanitization import sanitize_text
from ..services.research_design import project_access, member_relationship

_EDIT_CAPABLE_RELATIONSHIPS = {"PI", "CO_RESEARCHER", "DATA_ANALYST"}

router = APIRouter(prefix="/api/comments", tags=["comments"])


class CommentCreate(BaseModel):
    projectId: str
    contentAr: str
    contentEn: Optional[str] = None
    fieldKey: Optional[str] = None
    step: Optional[str] = None
    priority: Optional[str] = "NORMAL"


class CommentResolve(BaseModel):
    resolved: bool


def _serialize(c: ProjectComment) -> dict:
    return {
        "id": c.id,
        "projectId": c.projectId,
        "authorUsername": c.authorUsername,
        "fieldKey": c.fieldKey,
        "step": c.step,
        "contentAr": c.contentAr,
        "contentEn": c.contentEn,
        "resolved": c.resolved,
        "priority": c.priority,
        "createdAt": c.createdAt,
        "resolvedAt": c.resolvedAt,
        "organizationId": c.organizationId
    }


from ..services.notifications import (
    OutboxService,
    WorkflowEventType,
    AggregateType,
    EventPayload
)

@router.post("/")
def create_comment(
    body: CommentCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    # Verify the caller has an active relationship to the project (owner,
    # global admin, or an ACTIVE ResearchProjectMember) — organization
    # membership alone does not grant access to another member's project.
    proj = project_access(db, body.projectId, context)
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied in this organization"
        )

    comment = ProjectComment(
        id=str(uuid.uuid4()),
        projectId=body.projectId,
        organizationId=context.organization.id,
        authorId=context.user.id,
        authorUsername=context.user.username,
        fieldKey=body.fieldKey,
        step=body.step,
        contentAr=sanitize_text(body.contentAr),
        contentEn=sanitize_text(body.contentEn),
        resolved=False,
        priority=body.priority or "NORMAL",
        createdAt=datetime.now(timezone.utc).isoformat(),
    )
    db.add(comment)

    # Record Outbox Event for project comment
    OutboxService.record_event(
        db=db,
        organization_id=context.organization.id,
        event_type=WorkflowEventType.PROJECT_COMMENT_ADDED,
        aggregate_type=AggregateType.RESEARCH_PROJECT,
        aggregate_id=proj.id,
        actor_user_id=context.user.id,
        payload=EventPayload(
            title_ar="تعليق جديد على المشروع البحثي",
            title_en="New Project Workspace Comment",
            message_ar=f"أضاف {context.user.username} تعليقاً جديداً على مشروع ({proj.titleAr or proj.titleEn}).",
            message_en=f"{context.user.username} added a new comment on project ({proj.titleEn or proj.titleAr}).",
            target_type="RESEARCH_PROJECT",
            target_id=proj.id,
            meta={"comment_id": comment.id, "priority": comment.priority}
        ),
        scope_key=f"comment:{comment.id}"
    )

    db.commit()
    db.refresh(comment)

    return _serialize(comment)


@router.get("/project/{project_id}")
def list_project_comments(
    project_id: str,
    step: Optional[str] = None,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    proj = project_access(db, project_id, context)
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )

    query = db.query(ProjectComment).filter(
        ProjectComment.projectId == project_id,
        ProjectComment.organizationId == context.organization.id
    )
    if step:
        query = query.filter(ProjectComment.step == step)
    return [_serialize(c) for c in query.order_by(ProjectComment.createdAt.desc()).all()]


@router.patch("/{comment_id}/resolve")
def resolve_comment(
    comment_id: str,
    body: CommentResolve,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    comment = db.query(ProjectComment).filter(
        ProjectComment.id == comment_id,
        ProjectComment.organizationId == context.organization.id
    ).first()
    if not comment or not project_access(db, comment.projectId, context):
        raise HTTPException(status_code=404, detail="Comment not found or access denied")

    comment.resolved = body.resolved
    comment.resolvedAt = datetime.now(timezone.utc).isoformat() if body.resolved else None
    db.commit()
    return {"ok": True, "resolved": comment.resolved}


@router.delete("/{comment_id}")
def delete_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    comment = db.query(ProjectComment).filter(
        ProjectComment.id == comment_id,
        ProjectComment.organizationId == context.organization.id
    ).first()
    proj = project_access(db, comment.projectId, context) if comment else None
    if not comment or not proj:
        raise HTTPException(status_code=404, detail="Comment not found or access denied")

    # Deletion is narrower than viewing/resolving: the comment's own author,
    # an edit-capable project relationship, the project owner, or a global
    # admin — not just any member with read/comment access to the project.
    is_author = comment.authorId == context.user.id
    is_owner_or_admin = context.is_global_admin or proj.userId == context.user.id
    rel = member_relationship(db, proj, context.user.id)
    if not (is_author or is_owner_or_admin or rel in _EDIT_CAPABLE_RELATIONSHIPS):
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    db.delete(comment)
    db.commit()
    return {"ok": True}

