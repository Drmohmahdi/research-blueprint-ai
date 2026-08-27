"""
Research Data & Analysis authorization.

Capability model for a dataset (NOT a global permission catalog):

    Dataset Metadata  |  Data Dictionary  |  De-identified Preview  |
    Sensitive/Raw     |  Download         |  Upload                |
    Cleaning          |  Create Version   |  Run Analysis          |
    View Results      |  Review Analysis  |  Approve Analysis      |
    Export Results    |  Institutional Aggregate

Resolution precedence (first match wins):
  1. dataset.owner_id == user  -> full access to that dataset
  2. global admin              -> full access (platform operator)
  3. DatasetAccessGrant        -> adds the granted capability
  4. project relationship      -> base access (never sensitive/raw)
  5. organization membership   -> metadata only
"""
from __future__ import annotations

import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models

GRANT_CAPABILITIES = {
    "VIEW_SENSITIVE", "DOWNLOAD_RAW", "EXPORT_SENSITIVE", "CLEAN",
    "RUN_ANALYSIS", "REVIEW_ANALYSIS", "APPROVE_ANALYSIS", "CLASSIFY",
}

BASE_PROJECT_CAPABILITIES = {"VIEW_METADATA", "VIEW_DICTIONARY", "PREVIEW_DEIDENTIFIED", "VIEW_RESULTS"}


def utc_now() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def _granted_capabilities(db: Session, dataset_id: str, user_id: str, now: str) -> set[str]:
    rows = db.query(models.DatasetAccessGrant).filter(
        models.DatasetAccessGrant.dataset_id == dataset_id,
        models.DatasetAccessGrant.user_id == user_id,
        models.DatasetAccessGrant.status == "ACTIVE",
    ).all()
    caps = set()
    for row in rows:
        if row.expires_at and row.expires_at < now:
            row.status = "EXPIRED"
            db.flush()
            continue
        caps.add(row.capability)
    return caps


def project_relationship(db: Session, project: models.ResearchProject, user_id: str) -> str | None:
    if project.userId == user_id:
        return "OWNER"
    row = db.query(models.ResearchProjectMember).filter(
        models.ResearchProjectMember.project_id == project.id,
        models.ResearchProjectMember.user_id == user_id,
        models.ResearchProjectMember.status == "ACTIVE",
    ).first()
    return row.relationship if row else None


def resolve_capabilities(db: Session, dataset: models.ResearchDataset, context) -> set[str]:
    """Return the effective dataset capabilities for the requesting user.

    Precedence:
      1. dataset.owner_id == user  -> full access to that dataset
      2. explicit DatasetAccessGrant -> adds the granted capability
      3. project relationship      -> base access (never sensitive/raw)
      4. organization membership   -> metadata only

    Platform administration (global admin = SYSTEMADMIN/ADMIN/SUPERADMIN/
    DEVELOPER) is deliberately excluded from academic data access: platform
    operators manage tenants, subscriptions, configuration and service health,
    but they do NOT automatically receive VIEW_SENSITIVE, DOWNLOAD_RAW or
    EXPORT_SENSITIVE on research datasets. This keeps platform administration
    distinct from academic sensitive-data access.
    """
    now = utc_now()
    caps: set[str] = set()
    is_owner = dataset.owner_id == context.user.id
    if is_owner:
        caps = {
            "VIEW_METADATA", "VIEW_DICTIONARY", "PREVIEW_DEIDENTIFIED",
            "VIEW_SENSITIVE", "DOWNLOAD_RAW", "EXPORT_SENSITIVE", "CLEAN",
            "RUN_ANALYSIS", "VIEW_RESULTS", "REVIEW_ANALYSIS", "CLASSIFY",
            "CREATE_VERSION", "UPLOAD",
        }
        return caps

    # Platform operators may see metadata for operational diagnostics only.
    # They never inherit sensitive/raw/download/export academic access.
    if getattr(context, "is_global_admin", False):
        caps = {"VIEW_METADATA"}
        caps |= _granted_capabilities(db, dataset.id, context.user.id, now)
        return caps

    project = db.query(models.ResearchProject).filter(
        models.ResearchProject.id == dataset.project_id,
        models.ResearchProject.organizationId == dataset.organization_id,
    ).first()
    # All members of the dataset's organization may view metadata only
    # (name, version, rows, columns, quality/analysis status). No rows.
    caps = {"VIEW_METADATA"}
    if project:
        rel = project_relationship(db, project, context.user.id)
        if rel:
            caps |= set(BASE_PROJECT_CAPABILITIES)
        if rel in {"OWNER", "PI"}:
            caps |= {"CLEAN", "RUN_ANALYSIS", "REVIEW_ANALYSIS", "CREATE_VERSION"}
        elif rel == "CO_RESEARCHER":
            caps |= {"RUN_ANALYSIS", "VIEW_RESULTS"}
        elif rel == "DATA_ANALYST":
            caps |= {"RUN_ANALYSIS", "VIEW_RESULTS", "CLEAN"}
        elif rel == "RESEARCH_ASSISTANT":
            caps |= {"VIEW_RESULTS"}
        elif rel == "METHODOLOGY_REVIEWER":
            caps |= {"VIEW_RESULTS"}

    caps |= _granted_capabilities(db, dataset.id, context.user.id, now)
    return caps


def require_capability(db: Session, dataset: models.ResearchDataset, context, capability: str) -> None:
    caps = resolve_capabilities(db, dataset, context)
    if capability not in caps:
        raise HTTPException(
            403,
            f"You do not have the required dataset capability: {capability}",
        )


def has_capability(db: Session, dataset: models.ResearchDataset, context, capability: str) -> bool:
    return capability in resolve_capabilities(db, dataset, context)


def effective_access_level(db: Session, dataset: models.ResearchDataset, context) -> str:
    """One of: NONE, METADATA, DEIDENTIFIED, SENSITIVE."""
    caps = resolve_capabilities(db, dataset, context)
    if "VIEW_SENSITIVE" in caps:
        return "SENSITIVE"
    if "PREVIEW_DEIDENTIFIED" in caps:
        return "DEIDENTIFIED"
    if "VIEW_METADATA" in caps:
        return "METADATA"
    return "NONE"


def grant_dataset_access(db: Session, dataset: models.ResearchDataset, user_id: str,
                         capability: str, granted_by: str, reason: str | None = None,
                         expires_at: str | None = None) -> models.DatasetAccessGrant:
    if capability not in GRANT_CAPABILITIES:
        raise HTTPException(422, f"Unsupported dataset capability: {capability}")
    existing = db.query(models.DatasetAccessGrant).filter(
        models.DatasetAccessGrant.dataset_id == dataset.id,
        models.DatasetAccessGrant.user_id == user_id,
        models.DatasetAccessGrant.capability == capability,
        models.DatasetAccessGrant.status == "ACTIVE",
    ).first()
    if existing:
        return existing
    row = models.DatasetAccessGrant(
        id=f"dag-{dataset.id}-{user_id}-{capability}"[:64],
        organization_id=dataset.organization_id, dataset_id=dataset.id,
        project_id=dataset.project_id, user_id=user_id, capability=capability,
        granted_by=granted_by, reason=reason, status="ACTIVE",
        expires_at=expires_at, created_at=utc_now(),
    )
    db.add(row)
    db.flush()
    return row


def revoke_dataset_access(db: Session, dataset: models.ResearchDataset, user_id: str, capability: str) -> bool:
    row = db.query(models.DatasetAccessGrant).filter(
        models.DatasetAccessGrant.dataset_id == dataset.id,
        models.DatasetAccessGrant.user_id == user_id,
        models.DatasetAccessGrant.capability == capability,
        models.DatasetAccessGrant.status == "ACTIVE",
    ).first()
    if not row:
        return False
    row.status = "REVOKED"
    row.revoked_at = utc_now()
    db.flush()
    return True


def list_dataset_grants(db: Session, dataset: models.ResearchDataset) -> list[dict[str, Any]]:
    rows = db.query(models.DatasetAccessGrant).filter(
        models.DatasetAccessGrant.dataset_id == dataset.id,
        models.DatasetAccessGrant.status == "ACTIVE",
    ).all()
    return [
        {"id": r.id, "user_id": r.user_id, "capability": r.capability,
         "granted_by": r.granted_by, "reason": r.reason,
         "expires_at": r.expires_at, "created_at": r.created_at}
        for r in rows
    ]
