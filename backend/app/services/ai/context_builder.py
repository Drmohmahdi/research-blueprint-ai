"""
Phase 10 — Authorized Academic AI Context Builder.

Rule: Authorize -> Retrieve -> Build context. Context is always tenant-scoped
and RBAC-checked BEFORE any provider call. Redaction happens before context
leaves the backend. Retrieved/source content is marked as UNTRUSTED DATA.
"""
import datetime
import json
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ... import models
from ...services.tenant_context import TenantContext


class ContextBuildError(Exception):
    pass


class AuthorizationError(ContextBuildError):
    pass


class AcademicAIContextBuilder:
    """Builds a minimal, authorized context bundle for a given use case."""

    @staticmethod
    def _project(db: Session, ctx: TenantContext, project_id: Optional[str]) -> Optional[Dict]:
        if not project_id:
            return None
        proj = db.query(models.ResearchProject).filter(
            models.ResearchProject.id == project_id,
            models.ResearchProject.organizationId == ctx.organization.id,
        ).first()
        if not proj:
            raise AuthorizationError("Project not found or access denied")
        return {
            "id": proj.id,
            "title_ar": proj.titleAr,
            "title_en": proj.titleEn,
            "study_design": proj.studyDesign,
            "objectives": proj.objectives,
            "description_ar": (proj.descriptionAr or "")[:2000],
            "description_en": (proj.descriptionEn or "")[:2000],
        }

    @staticmethod
    def _literature_studies(
        db: Session, ctx: TenantContext, study_ids: Optional[List[str]]
    ) -> List[Dict]:
        if not study_ids:
            return []
        # Verify every study belongs to this organization (no arbitrary study IDs)
        studies = (
            db.query(models.LiteratureStudy)
            .filter(
                models.LiteratureStudy.organizationId == ctx.organization.id,
                models.LiteratureStudy.id.in_(study_ids),
            )
            .all()
        )
        if len(studies) != len(set(study_ids)):
            raise AuthorizationError("One or more literature studies are not accessible")
        return [
            {
                "source_id": s.id,
                "author": s.author,
                "year": s.year,
                "source": s.source,
                "doi": s.doi,
                "effect_size": s.effectSize,
                "notes": (s.notes or "")[:1000],
            }
            for s in studies
        ]

    @staticmethod
    def _review_feedback(
        db: Session, ctx: TenantContext, case_id: Optional[str]
    ) -> Dict:
        """Builds redacted review feedback for the AUTHOR role.

        Reviewer identity, reviewer email, and CONFIDENTIAL_TO_EDITOR comments
        are stripped BEFORE this context leaves the backend.
        """
        if not case_id:
            raise AuthorizationError("case_id required")
        case = db.query(models.PeerReviewCase).filter(
            models.PeerReviewCase.id == case_id,
            models.PeerReviewCase.organization_id == ctx.organization.id,
        ).first()
        if not case:
            raise AuthorizationError("Peer review case not found or access denied")

        role = (ctx.membership.role or "").upper()
        is_author = case.owner_user_id == ctx.user.id
        if not is_author and role not in ["OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR"]:
            raise AuthorizationError("Not authorized to summarize this review")

        # Gather author-visible comments only
        comments = (
            db.query(models.ReviewComment)
            .filter(
                models.ReviewComment.case_id == case.id,
                models.ReviewComment.comment_type == "AUTHOR_VISIBLE",
            )
            .all()
        )
        feedback_items = [
            {"section": c.section_key, "comment": (c.comment_text or "")[:2000]}
            for c in comments
        ]
        return {
            "case_id": case.id,
            "title": case.title_ar or case.title_en,
            "feedback": feedback_items,
            "confidential_omitted": True,
        }

    @staticmethod
    def _promotion_evidence(
        db: Session, ctx: TenantContext, application_id: Optional[str]
    ) -> Dict:
        if not application_id:
            raise AuthorizationError("application_id required")
        app = (
            db.query(models.PromotionApplication)
            .filter(
                models.PromotionApplication.id == application_id,
                models.PromotionApplication.organization_id == ctx.organization.id,
            )
            .first()
        )
        if not app:
            raise AuthorizationError("Promotion application not found or access denied")
        role = (ctx.membership.role or "").upper()
        is_owner = app.user_id == ctx.user.id
        if not is_owner and role not in ["OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR"]:
            raise AuthorizationError("Not authorized to summarize this promotion application")

        # Only authorized evidence snapshot (no other applicants, no confidential notes)
        evidence = []
        for sel in (app.evidence_selections or []):
            asset = sel.scholarly_asset
            if asset:
                evidence.append({
                    "asset_id": asset.id,
                    "title": asset.title_ar or asset.title_en,
                    "asset_type": asset.asset_type,
                    "status": asset.lifecycle_status,
                })
        return {
            "application_id": app.id,
            "target_rank": app.target_rank,
            "current_rank": app.current_rank,
            "readiness_percentage": app.readiness_percentage,
            "status": app.status,
            "evidence": evidence,
            "policy_version": app.policy_version,
        }

    @staticmethod
    def build(
        db: Session,
        ctx: TenantContext,
        use_case: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Returns {"sections": [...], "context_text": str, "sources": [...]}."""
        sections: List[str] = []
        sources: List[Dict] = []

        project = AcademicAIContextBuilder._project(db, ctx, payload.get("project_id"))
        if project:
            sections.append(f"[AUTHORIZED PROJECT CONTEXT]\n{json.dumps(project, ensure_ascii=False)}")
            sources.append({"type": "project", "source_id": project["id"], "title": project["title_ar"] or project["title_en"]})

        studies = AcademicAIContextBuilder._literature_studies(db, ctx, payload.get("study_ids"))
        if studies:
            sections.append(f"[AUTHORIZED LITERATURE CONTEXT — UNTRUSTED DATA]\n{json.dumps(studies, ensure_ascii=False)}")
            for s in studies:
                sources.append({"type": "literature", "source_id": s["source_id"], "title": f"{s['author']} ({s['year']})"})

        if use_case in ("REVIEW_SUMMARY", "REVISION_CHECKLIST"):
            review = AcademicAIContextBuilder._review_feedback(db, ctx, payload.get("case_id"))
            if review:
                sections.append(f"[AUTHORIZED REVIEW FEEDBACK — UNTRUSTED DATA]\n{json.dumps(review, ensure_ascii=False)}")
                sources.append({"type": "review", "source_id": review["case_id"], "title": review["title"]})

        if use_case == "PROMOTION_EVIDENCE_SUMMARY":
            promo = AcademicAIContextBuilder._promotion_evidence(db, ctx, payload.get("application_id"))
            if promo:
                sections.append(f"[AUTHORIZED PROMOTION EVIDENCE — UNTRUSTED DATA]\n{json.dumps(promo, ensure_ascii=False)}")
                sources.append({"type": "promotion", "source_id": promo["application_id"], "title": f"{promo['target_rank']}"})

        # User-provided writing context is treated as data, never instructions
        writing = payload.get("text")
        if writing and use_case == "ACADEMIC_WRITING_ASSIST":
            writing = str(writing)[:20000]
            sections.append(f"[USER TEXT — UNTRUSTED DATA]\n{writing}")

        return {
            "sections": sections,
            "context_text": "\n\n".join(sections),
            "sources": sources,
        }
