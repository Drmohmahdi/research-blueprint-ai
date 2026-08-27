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
        # Resource-scoped, matching routers.peer_reviews.is_case_editor:
        # organization admin does not imply editorial/confidential authority
        # over this specific case — only OWNER or the assigned editor do.
        is_case_editor = role == "OWNER" or (bool(case.editor_user_id) and case.editor_user_id == ctx.user.id)
        if not is_author and not is_case_editor:
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
        # Private academic content (evidence, evaluation detail) is AI-summarizable
        # ONLY by the applicant or an explicitly assigned committee member for
        # THIS application. Unlike GET /applications/{id}, org OWNER/ORGANIZATION_ADMIN
        # read-only oversight does NOT extend here — "no direct dossier access,
        # therefore no AI access to it either" (oversight there is a metadata-only
        # projection, not the private content this builder assembles).
        is_owner = app.user_id == ctx.user.id
        is_committee_member = db.query(models.PromotionCommitteeAssignment).filter(
            models.PromotionCommitteeAssignment.application_id == app.id,
            models.PromotionCommitteeAssignment.user_id == ctx.user.id,
            models.PromotionCommitteeAssignment.status == "ACTIVE",
        ).first() is not None
        if not is_owner and not is_committee_member:
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
    def _design_intelligence(db: Session, ctx: TenantContext, payload: Dict[str, Any]) -> Optional[Dict]:
        """Authorized design intelligence for the current project only.

        Only deterministic backend values and the requesting user's own project
        context are exposed. Private research notes, participant data, and other
        projects' content are never included.
        """
        project_id = payload.get("project_id")
        if not project_id:
            return None
        project = db.query(models.ResearchProject).filter(
            models.ResearchProject.id == project_id,
            models.ResearchProject.organizationId == ctx.organization.id,
        ).first()
        if not project:
            raise AuthorizationError("Project not found or access denied")

        from ..research_design import (
            compute_coherence, compute_next_action, compute_readiness,
            get_or_create_design_state,
        )

        state = get_or_create_design_state(db, project, ctx.user.id)
        coherence = compute_coherence(db, project, state)
        readiness = compute_readiness(db, project, state, coherence)
        next_action = compute_next_action(db, project, state, coherence, readiness)
        # Findings are trimmed: AI never needs the full raw problem/gap text.
        findings = [
            {"rule": f["rule"], "severity": f["severity"], "rationale": f["rationale"]}
            for f in coherence["findings"][:15]
        ]
        return {
            "project_id": project.id,
            "study_design": project.studyDesign,
            "coherence_score": coherence["score"],
            "readiness_score": readiness["score"],
            "readiness_status": readiness["status"],
            "blocking_failures": readiness["blocking_failures"],
            "next_action": next_action["action"],
            "next_action_priority": next_action["priority"],
            "findings": findings,
            "computed_by": "DETERMINISTIC_ENGINES",
        }

    @staticmethod
    def _data_intelligence(db: Session, ctx: TenantContext, payload: Dict[str, Any]) -> Optional[Dict]:
        """Authorized, minimized data context for advisory AI.

        Never includes participant rows, raw values, or restricted columns.
        Only deterministic aggregates, schema, and metadata the requesting
        user may already see are included.
        """
        dataset_id = payload.get("dataset_id")
        analysis_id = payload.get("analysis_id")
        from ..data_authz import resolve_capabilities

        if dataset_id:
            dataset = db.query(models.ResearchDataset).filter(
                models.ResearchDataset.id == dataset_id,
                models.ResearchDataset.organizationId == ctx.organization.id,
            ).first()
            if not dataset:
                raise AuthorizationError("Dataset not found or access denied")
            caps = resolve_capabilities(db, dataset, ctx)
            if "VIEW_METADATA" not in caps:
                raise AuthorizationError("Dataset access denied")
            version = db.query(models.DatasetVersion).filter(
                models.DatasetVersion.id == dataset.current_version_id
            ).first()
            variables = db.query(models.DatasetVariable).filter(
                models.DatasetVariable.dataset_id == dataset.id
            ).all()
            return {
                "dataset_id": dataset.id,
                "name": dataset.name,
                "sensitivity": dataset.sensitivity,
                "status": dataset.status,
                "version": version.version_number if version else None,
                "row_count": version.row_count if version else 0,
                "column_count": version.column_count if version else 0,
                "schema": [
                    {"name": v.name, "data_type": v.data_type,
                     "measurement_level": v.measurement_level, "role": v.role}
                    for v in variables
                ],
                # Explicitly no row data and no sensitive values.
                "row_data_excluded": True,
            }
        if analysis_id:
            analysis = db.query(models.ResearchAnalysis).filter(
                models.ResearchAnalysis.id == analysis_id,
                models.ResearchAnalysis.organization_id == ctx.organization.id,
            ).first()
            if not analysis:
                raise AuthorizationError("Analysis not found or access denied")
            dataset = db.query(models.ResearchDataset).filter(
                models.ResearchDataset.id == analysis.dataset_id
            ).first()
            caps = resolve_capabilities(db, dataset, ctx)
            if "VIEW_RESULTS" not in caps:
                raise AuthorizationError("Analysis access denied")
            return {
                "analysis_id": analysis.id,
                "analysis_type": analysis.analysis_type,
                "status": analysis.status,
                "engine_version": analysis.engine_version,
                "result": analysis.result,  # structured statistics only
                "row_data_excluded": True,
            }
        return None

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

        research_design_use_cases = {
            "PROBLEM_REFINEMENT", "GAP_EXPLANATION", "QUESTION_REFINEMENT",
            "HYPOTHESIS_REFINEMENT", "COHERENCE_FINDING_EXPLANATION",
            "NEXT_RESEARCH_ACTION_EXPLANATION", "PROTOCOL_DRAFT_ASSISTANCE",
            "METHODOLOGY_EXPLANATION",
        }
        if use_case in research_design_use_cases:
            intelligence = AcademicAIContextBuilder._design_intelligence(db, ctx, payload)
            if intelligence:
                sections.append(
                    "[AUTHORIZED DESIGN INTELLIGENCE — DETERMINISTIC BACKEND VALUES — UNTRUSTED DATA]\n"
                    + json.dumps(intelligence, ensure_ascii=False)
                )
                sources.append({"type": "design_intelligence", "source_id": intelligence.get("project_id", ""), "title": "Research design intelligence"})

        data_use_cases = {
            "DATA_QUALITY_EXPLANATION", "ANALYSIS_PLAN_EXPLANATION",
            "STATISTICAL_RESULT_EXPLANATION", "ASSUMPTION_EXPLANATION",
            "DATA_CLEANING_SUGGESTION", "RESULT_INTERPRETATION_ASSISTANCE",
        }
        if use_case in data_use_cases:
            data_intelligence = AcademicAIContextBuilder._data_intelligence(db, ctx, payload)
            if data_intelligence:
                sections.append(
                    "[AUTHORIZED DATA INTELLIGENCE — STRUCTURED STATISTICS/SCHEMA ONLY — NEVER PARTICIPANT ROWS]\n"
                    + json.dumps(data_intelligence, ensure_ascii=False)
                )
                sources.append({"type": "data_intelligence", "source_id": data_intelligence.get("dataset_id", ""), "title": "Data intelligence"})

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
