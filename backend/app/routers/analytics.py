from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import datetime

from ..db import get_db
from .. import models
from ..services.tenant_context import get_tenant_context, TenantContext

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/overview")
def get_analytics_overview(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    """Returns analytics data for the organization's projects"""
    projects = db.query(models.ResearchProject).filter(
        models.ResearchProject.organizationId == context.organization.id
    ).all()

    # Calculate overall progress per project
    project_stats = []
    total_completed = 0
    
    for p in projects:
        # Assuming 18 steps total for NEW_STUDY_DESIGN
        completed = len(p.completedSteps) if p.completedSteps else 0
        total_completed += completed
        project_stats.append({
            "id": p.id,
            "title": p.titleEn or p.titleAr or "Untitled",
            "completedSteps": completed,
            "totalSteps": 18,
            "progressPct": round((completed / 18) * 100) if completed > 0 else 0
        })

    # Historical progress from real audit events in this organization, not a synthetic trend.
    now = datetime.datetime.now(datetime.UTC)
    logs = db.query(models.AuditLog).filter(
        models.AuditLog.organizationId == context.organization.id
    ).all()
    history = []
    for i in range(5, -1, -1):
        month_date = now - datetime.timedelta(days=i * 30)
        key = month_date.strftime("%Y-%m")
        month_count = 0
        for log in logs:
            try:
                stamp = datetime.datetime.fromisoformat(str(log.timestamp).replace("Z", "+00:00"))
            except (TypeError, ValueError):
                continue
            if stamp.strftime("%Y-%m") == key:
                month_count += 1
        history.append({
            "month": month_date.strftime("%b"),
            "completedTasks": month_count,
        })

    return {
        "totalProjects": len(projects),
        "totalCompletedTasks": total_completed,
        "projectComparison": project_stats,
        "progressHistory": history
    }

