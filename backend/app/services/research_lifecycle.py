import datetime
import hashlib
import json
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models
from .notifications.events import AggregateType, EventPayload, WorkflowEventType
from .notifications.outbox import OutboxService


def utc_now() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:16]}"


TEMPLATES: dict[str, list[str]] = {
    "EMPIRICAL_QUANTITATIVE": [
        "RESEARCH_DESIGN", "DATA_COLLECTION", "DATA_PREPARATION", "ANALYSIS",
        "MANUSCRIPT", "SUBMISSION", "PEER_REVIEW", "REVISION", "ACCEPTED",
        "PUBLISHED", "DISSEMINATION", "PROMOTION_EVIDENCE",
    ],
    "CONCEPTUAL_THEORETICAL": [
        "RESEARCH_DESIGN", "LITERATURE_SYNTHESIS", "MANUSCRIPT", "SUBMISSION",
        "PEER_REVIEW", "REVISION", "ACCEPTED", "PUBLISHED", "DISSEMINATION",
        "PROMOTION_EVIDENCE",
    ],
    "SYSTEMATIC_REVIEW": [
        "RESEARCH_DESIGN", "SEARCH_STRATEGY", "SCREENING", "PRISMA",
        "SYNTHESIS", "MANUSCRIPT", "SUBMISSION", "PEER_REVIEW", "REVISION",
        "ACCEPTED", "PUBLISHED", "DISSEMINATION", "PROMOTION_EVIDENCE",
    ],
    "QUALITATIVE": [
        "RESEARCH_DESIGN", "QUALITATIVE_DATA", "QUALITATIVE_ANALYSIS",
        "MANUSCRIPT", "SUBMISSION", "PEER_REVIEW", "REVISION", "ACCEPTED",
        "PUBLISHED", "DISSEMINATION", "PROMOTION_EVIDENCE",
    ],
}


def resolve_template(project: models.ResearchProject) -> str:
    design = (project.studyDesign or "").casefold()
    if any(token in design for token in ("systematic", "prisma", "meta_analysis", "review")):
        return "SYSTEMATIC_REVIEW"
    if any(token in design for token in ("conceptual", "theoretical", "نظري", "مفاهيمي")):
        return "CONCEPTUAL_THEORETICAL"
    if any(token in design for token in ("qualitative", "نوعي")):
        return "QUALITATIVE"
    return "EMPIRICAL_QUANTITATIVE"


def get_or_create_lifecycle(db: Session, project: models.ResearchProject, user_id: str | None) -> models.ResearchLifecycle:
    item = db.query(models.ResearchLifecycle).filter(
        models.ResearchLifecycle.project_id == project.id,
        models.ResearchLifecycle.organization_id == project.organizationId,
    ).first()
    template = resolve_template(project)
    stamp = utc_now()
    if item:
        if item.template_key != template:
            item.template_key = template
            item.updated_at = stamp
        return item
    item = models.ResearchLifecycle(
        id=new_id("life"), organization_id=project.organizationId, project_id=project.id,
        template_key=template, template_version=1, created_by=user_id,
        created_at=stamp, updated_at=stamp,
    )
    db.add(item)
    db.flush()
    return item


def _stage(status: str, readiness: int, blockers: list[str], outputs: list[dict[str, Any]], action: str | None = None) -> dict[str, Any]:
    return {
        "status": status, "readiness": readiness, "blockers": blockers,
        "outputs": outputs, "next_action": action,
    }


def build_summary(db: Session, project: models.ResearchProject, user_id: str | None) -> dict[str, Any]:
    lifecycle = get_or_create_lifecycle(db, project, user_id)
    datasets = db.query(models.ResearchDataset).filter(
        models.ResearchDataset.organization_id == project.organizationId,
        models.ResearchDataset.project_id == project.id,
    ).all()
    analyses = db.query(models.ResearchAnalysis).filter(
        models.ResearchAnalysis.organization_id == project.organizationId,
        models.ResearchAnalysis.project_id == project.id,
    ).all()
    assets = db.query(models.ScholarlyAsset).filter(
        models.ScholarlyAsset.organization_id == project.organizationId,
        models.ScholarlyAsset.source_record_id == project.id,
        models.ScholarlyAsset.deleted_at.is_(None),
    ).all()
    reviews = db.query(models.PeerReviewCase).filter(
        models.PeerReviewCase.organization_id == project.organizationId,
        models.PeerReviewCase.project_id == project.id,
    ).all()
    literature_count = db.query(models.LiteratureStudy).filter(
        models.LiteratureStudy.organizationId == project.organizationId,
        models.LiteratureStudy.projectId == project.id,
    ).count()
    prisma = db.query(models.PrismaFlow).filter(
        models.PrismaFlow.organizationId == project.organizationId,
        models.PrismaFlow.projectId == project.id,
    ).first()

    design_parts = [bool(project.titleAr or project.titleEn), bool(project.problemStatementAr or project.problemStatementEn), bool(project.questions), bool(project.variables)]
    design_readiness = round(sum(design_parts) / len(design_parts) * 100)
    manuscripts = [a for a in assets if a.asset_type == "MANUSCRIPT"]
    published = [a for a in assets if a.lifecycle_status == "PUBLISHED"]
    accepted = [a for a in assets if a.lifecycle_status in {"ACCEPTED", "PUBLISHED"}]
    current_analyses = [a for a in analyses if a.status == "COMPLETED"]
    stale_analyses = [a for a in analyses if a.status == "STALE"]
    review_statuses = {r.status for r in reviews}
    has_revision = any(r.status == "REVISION_REQUESTED" for r in reviews)
    selections = 0
    if assets:
        selections = db.query(models.PromotionAssetSelection).filter(
            models.PromotionAssetSelection.scholarly_asset_id.in_([a.id for a in assets])
        ).count()

    evidence: dict[str, dict[str, Any]] = {
        "RESEARCH_DESIGN": _stage("COMPLETED" if design_readiness == 100 else "IN_PROGRESS", design_readiness,
            [] if design_readiness == 100 else ["أكمل مشكلة البحث والأسئلة والمتغيرات المفاهيمية"], [], "فتح مساحة تصميم البحث"),
        "DATA_COLLECTION": _stage("COMPLETED" if datasets else "AVAILABLE", 100 if datasets else 0,
            [] if datasets else ["لم تُربط مجموعة بيانات بالمشروع"], [{"type": "DATASET", "id": d.id, "title": d.name} for d in datasets], "استيراد بيانات البحث"),
        "DATA_PREPARATION": _stage("COMPLETED" if datasets and all(d.status == "READY" for d in datasets) else "BLOCKED" if datasets else "NOT_STARTED",
            100 if datasets and all(d.status == "READY" for d in datasets) else 40 if datasets else 0,
            ["توجد مشكلات جودة بيانات مفتوحة"] if datasets and any(d.status != "READY" for d in datasets) else [], [], "معالجة جودة البيانات"),
        "ANALYSIS": _stage("STALE" if stale_analyses and not current_analyses else "COMPLETED" if current_analyses else "AVAILABLE" if datasets else "BLOCKED",
            100 if current_analyses else 25 if analyses else 0,
            ["أعد تشغيل التحليل على أحدث إصدار بيانات"] if stale_analyses and not current_analyses else ([] if datasets else ["يتطلب مجموعة بيانات"]),
            [{"type": "ANALYSIS", "id": a.id, "title": a.analysis_type, "status": a.status, "approved": bool(a.approved_at)} for a in analyses], "فتح استوديو التحليل"),
        "LITERATURE_SYNTHESIS": _stage("COMPLETED" if literature_count else "AVAILABLE", 100 if literature_count else 0, [], [], "فتح تركيب الأدبيات"),
        "SEARCH_STRATEGY": _stage("COMPLETED" if literature_count else "IN_PROGRESS", 100 if literature_count else 30, [], [], "استكمال استراتيجية البحث"),
        "SCREENING": _stage("COMPLETED" if literature_count else "AVAILABLE", 100 if literature_count else 0, [], [], "استكمال فرز الدراسات"),
        "PRISMA": _stage("COMPLETED" if prisma else "AVAILABLE", 100 if prisma else 0, [], [], "إنشاء مخطط PRISMA"),
        "SYNTHESIS": _stage("COMPLETED" if literature_count else "BLOCKED", 100 if literature_count else 0, [] if literature_count else ["يتطلب دراسات مُضمّنة"], [], "تركيب الأدلة"),
        "QUALITATIVE_DATA": _stage("DEFERRED_CAPABILITY", 0, [], [], None),
        "QUALITATIVE_ANALYSIS": _stage("DEFERRED_CAPABILITY", 0, [], [], None),
        "MANUSCRIPT": _stage("COMPLETED" if manuscripts else "AVAILABLE" if design_readiness == 100 else "BLOCKED", 100 if manuscripts else 0,
            [] if design_readiness == 100 else ["أكمل تصميم البحث"], [{"type": "SCHOLARLY_ASSET", "id": a.id, "title": a.title_ar or a.title_en} for a in manuscripts], "إنشاء المخطوطة"),
        "SUBMISSION": _stage("COMPLETED" if reviews else "AVAILABLE" if manuscripts else "BLOCKED", 100 if reviews else 0, [] if manuscripts else ["يتطلب مخطوطة"], [], "بدء ملف التحكيم"),
        "PEER_REVIEW": _stage("COMPLETED" if "DECIDED" in review_statuses else "IN_PROGRESS" if reviews else "NOT_STARTED", 100 if "DECIDED" in review_statuses else 50 if reviews else 0, [], [], "متابعة التحكيم"),
        "REVISION": _stage("IN_PROGRESS" if has_revision else "NOT_REQUIRED" if "DECIDED" in review_statuses else "NOT_STARTED", 50 if has_revision else 100 if "DECIDED" in review_statuses else 0, [], [], "الرد على المحكمين" if has_revision else None),
        "ACCEPTED": _stage("COMPLETED" if accepted else "NOT_STARTED", 100 if accepted else 0, [], [], None),
        "PUBLISHED": _stage("COMPLETED" if published else "AVAILABLE" if accepted else "BLOCKED", 100 if published else 0, [] if accepted else ["يتطلب قرار قبول وبيانات نشر"], [], "استكمال بيانات النشر"),
        "DISSEMINATION": _stage("AVAILABLE" if published else "BLOCKED", 50 if published else 0, [] if published else ["يتطلب منشورًا موثقًا"], [], "إضافة المنشور للملف الأكاديمي"),
        "PROMOTION_EVIDENCE": _stage("COMPLETED" if selections else "AVAILABLE" if published else "BLOCKED", 100 if selections else 0, [] if published else ["يتطلب مخرجًا منشورًا"], [], "اختيار دليل الترقية"),
    }

    ordered = []
    predecessor_complete = True
    for key in TEMPLATES[lifecycle.template_key]:
        item = {"key": key, **evidence[key]}
        if item["status"] in {"AVAILABLE", "NOT_STARTED"} and not predecessor_complete:
            item["status"] = "BLOCKED"
        ordered.append(item)
        predecessor_complete = item["status"] in {"COMPLETED", "NOT_REQUIRED", "DEFERRED_CAPABILITY"}

    required = [s for s in ordered if s["status"] not in {"NOT_REQUIRED", "DEFERRED_CAPABILITY"}]
    completed = [s for s in required if s["status"] == "COMPLETED"]
    progress = round(len(completed) / max(1, len(required)) * 100)
    current = next((s for s in ordered if s["status"] not in {"COMPLETED", "NOT_REQUIRED", "DEFERRED_CAPABILITY"}), ordered[-1])
    priority = "CRITICAL" if current["status"] in {"BLOCKED", "STALE"} else "HIGH"
    next_action = {
        "priority": priority,
        "stage": current["key"],
        "title": current.get("next_action") or "راجع المرحلة الحالية",
        "rationale": current["blockers"][0] if current["blockers"] else "الإجراء التالي وفق ترتيب واعتماديات دورة البحث",
        "computed_by": "DETERMINISTIC_LIFECYCLE_ENGINE",
    }
    return {
        "lifecycle_id": lifecycle.id, "project_id": project.id,
        "template": lifecycle.template_key, "template_version": lifecycle.template_version,
        "progress": progress, "current_stage": current["key"],
        "current_stage_readiness": current["readiness"], "next_action": next_action,
        "stages": ordered,
    }


def mapping_create(db: Session, project: models.ResearchProject, research_variable_id: str, dataset_variable_id: str, role: str, user_id: str) -> models.ResearchVariableMapping:
    research_var = db.query(models.ResearchVariable).filter(
        models.ResearchVariable.id == research_variable_id,
        models.ResearchVariable.projectId == project.id,
    ).first()
    dataset_var = db.query(models.DatasetVariable).join(
        models.ResearchDataset, models.DatasetVariable.dataset_id == models.ResearchDataset.id
    ).filter(
        models.DatasetVariable.id == dataset_variable_id,
        models.DatasetVariable.organization_id == project.organizationId,
        models.ResearchDataset.project_id == project.id,
    ).first()
    if not research_var or not dataset_var:
        raise HTTPException(422, "Variables must belong to the same authorized project")
    existing = db.query(models.ResearchVariableMapping).filter(
        models.ResearchVariableMapping.research_variable_id == research_variable_id,
        models.ResearchVariableMapping.dataset_variable_id == dataset_variable_id,
    ).first()
    if existing:
        return existing
    item = models.ResearchVariableMapping(
        id=new_id("map"), organization_id=project.organizationId, project_id=project.id,
        research_variable_id=research_variable_id, dataset_variable_id=dataset_variable_id,
        mapping_role=role.upper(), created_by=user_id, created_at=utc_now(),
    )
    db.add(item)
    db.flush()
    add_lineage(db, project, "RESEARCH_VARIABLE", research_variable_id, None, "MAPS_TO", "DATASET_VARIABLE", dataset_variable_id, None, user_id)
    return item


def add_lineage(db: Session, project: models.ResearchProject, source_type: str, source_id: str, source_version: str | None,
                relation: str, target_type: str, target_id: str, target_version: str | None, user_id: str | None) -> models.ResearchLineageEdge:
    existing = db.query(models.ResearchLineageEdge).filter(
        models.ResearchLineageEdge.relationship_type == relation,
        models.ResearchLineageEdge.source_entity_type == source_type,
        models.ResearchLineageEdge.source_entity_id == source_id,
        models.ResearchLineageEdge.target_entity_type == target_type,
        models.ResearchLineageEdge.target_entity_id == target_id,
    ).first()
    if existing:
        return existing
    edge = models.ResearchLineageEdge(
        id=new_id("edge"), organization_id=project.organizationId, project_id=project.id,
        source_entity_type=source_type, source_entity_id=source_id, source_version=source_version,
        relationship_type=relation, target_entity_type=target_type, target_entity_id=target_id,
        target_version=target_version, created_by=user_id, created_at=utc_now(),
    )
    db.add(edge)
    db.flush()
    return edge


def create_handoff(db: Session, project: models.ResearchProject, handoff_type: str, source_id: str,
                   target_id: str | None, user_id: str) -> models.AcademicHandoff:
    handoff_type = handoff_type.upper()
    allowed = {
        "RESEARCH_TO_DATA", "DATA_TO_PUBLICATION", "PUBLICATION_TO_REVIEW",
        "REVIEW_TO_PUBLICATION", "PUBLICATION_TO_IDENTITY", "PUBLICATION_TO_PROMOTION",
    }
    if handoff_type not in allowed:
        raise HTTPException(422, "Unsupported academic handoff")

    source_type = "RESEARCH_PROJECT"
    source_version = str(project.version)
    source_fingerprint = None
    target_domain = "DATA"
    target_type = None
    payload: dict[str, Any] = {"project_id": project.id}
    dependency_analysis = None
    dependency_asset = None

    if handoff_type == "RESEARCH_TO_DATA":
        if source_id != project.id:
            raise HTTPException(422, "Research handoff source must be the authorized project")
        payload.update({
            "question_ids": [q.id for q in project.questions],
            "hypothesis_ids": [h.id for h in project.hypotheses],
            "conceptual_variable_ids": [v.id for v in project.variables],
            "study_design": project.studyDesign,
        })
    elif handoff_type == "DATA_TO_PUBLICATION":
        analysis = db.query(models.ResearchAnalysis).filter(
            models.ResearchAnalysis.id == source_id,
            models.ResearchAnalysis.project_id == project.id,
            models.ResearchAnalysis.organization_id == project.organizationId,
        ).first()
        asset = db.query(models.ScholarlyAsset).filter(
            models.ScholarlyAsset.id == target_id,
            models.ScholarlyAsset.organization_id == project.organizationId,
            models.ScholarlyAsset.source_record_id == project.id,
            models.ScholarlyAsset.asset_type == "MANUSCRIPT",
            models.ScholarlyAsset.deleted_at.is_(None),
        ).first()
        dataset = db.query(models.ResearchDataset).filter(models.ResearchDataset.id == analysis.dataset_id).first() if analysis else None
        if not analysis or not asset or analysis.status != "COMPLETED" or not analysis.approved_at or not dataset or dataset.current_version_id != analysis.dataset_version_id:
            raise HTTPException(409, "Only a current, completed, human-approved analysis may be handed to an authorized manuscript")
        source_type, source_version, target_domain, target_type = "ANALYSIS", analysis.engine_version, "PUBLICATION", "SCHOLARLY_ASSET"
        payload.update({"analysis_id": analysis.id, "dataset_version_id": analysis.dataset_version_id, "engine_version": analysis.engine_version, "approved_at": analysis.approved_at, "approved_by": analysis.approved_by, "result": analysis.result})
        dependency_analysis, dependency_asset = analysis, asset
    elif handoff_type == "PUBLICATION_TO_REVIEW":
        asset = db.query(models.ScholarlyAsset).filter(
            models.ScholarlyAsset.id == source_id, models.ScholarlyAsset.organization_id == project.organizationId,
            models.ScholarlyAsset.source_record_id == project.id, models.ScholarlyAsset.asset_type == "MANUSCRIPT",
        ).first()
        case = db.query(models.PeerReviewCase).filter(
            models.PeerReviewCase.id == target_id, models.PeerReviewCase.organization_id == project.organizationId,
            models.PeerReviewCase.project_id == project.id,
        ).first()
        if not asset or not case or case.scholarly_asset_id != asset.id:
            raise HTTPException(422, "Review case must reference the authorized manuscript")
        source_type, source_version, target_domain, target_type = "SCHOLARLY_ASSET", str(asset.version_number), "PEER_REVIEW", "PEER_REVIEW_CASE"
        payload.update({"scholarly_asset_id": asset.id, "manuscript_version": asset.version_number})
    elif handoff_type == "REVIEW_TO_PUBLICATION":
        case = db.query(models.PeerReviewCase).filter(
            models.PeerReviewCase.id == source_id, models.PeerReviewCase.organization_id == project.organizationId,
            models.PeerReviewCase.project_id == project.id,
        ).first()
        asset = db.query(models.ScholarlyAsset).filter(
            models.ScholarlyAsset.id == target_id, models.ScholarlyAsset.organization_id == project.organizationId,
        ).first()
        if not case or not asset or case.scholarly_asset_id != asset.id or case.status != "DECIDED":
            raise HTTPException(409, "A decided review linked to the manuscript is required")
        source_type, source_version, target_domain, target_type = "PEER_REVIEW_CASE", str(case.current_round_number), "PUBLICATION", "SCHOLARLY_ASSET"
        payload.update({"case_id": case.id, "decision_recorded": True})
    elif handoff_type in {"PUBLICATION_TO_IDENTITY", "PUBLICATION_TO_PROMOTION"}:
        asset = db.query(models.ScholarlyAsset).filter(
            models.ScholarlyAsset.id == source_id, models.ScholarlyAsset.organization_id == project.organizationId,
            models.ScholarlyAsset.source_record_id == project.id, models.ScholarlyAsset.lifecycle_status == "PUBLISHED",
        ).first()
        if not asset:
            raise HTTPException(409, "Only an authorized published output can be handed off")
        source_type, source_version = "SCHOLARLY_ASSET", str(asset.version_number)
        target_domain = "IDENTITY" if handoff_type.endswith("IDENTITY") else "PROMOTION"
        target_type = "ACADEMIC_PROFILE" if target_domain == "IDENTITY" else "PROMOTION_APPLICATION"
        if target_domain == "PROMOTION":
            application = db.query(models.PromotionApplication).filter(
                models.PromotionApplication.id == target_id,
                models.PromotionApplication.organization_id == project.organizationId,
                models.PromotionApplication.user_id == user_id,
            ).first()
            if not application:
                raise HTTPException(422, "Promotion application is not authorized")
        payload.update({"scholarly_asset_id": asset.id, "candidate_only": target_domain == "PROMOTION", "human_selection_required": target_domain == "PROMOTION"})

    key_material = f"{project.organizationId}:{project.id}:{handoff_type}:{source_id}:{source_version}:{target_id or ''}"
    key = hashlib.sha256(key_material.encode()).hexdigest()
    existing = db.query(models.AcademicHandoff).filter(models.AcademicHandoff.idempotency_key == key).first()
    if existing:
        return existing
    snapshot = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    item = models.AcademicHandoff(
        id=new_id("handoff"), organization_id=project.organizationId, project_id=project.id,
        handoff_type=handoff_type, source_entity_type=source_type, source_entity_id=source_id,
        source_version=source_version, source_fingerprint=source_fingerprint or hashlib.sha256(snapshot.encode()).hexdigest(),
        target_domain=target_domain, target_entity_type=target_type, target_entity_id=target_id,
        payload_json=payload, schema_version=1, status="PENDING", idempotency_key=key,
        created_by=user_id, created_at=utc_now(),
    )
    db.add(item)
    db.flush()
    add_lineage(db, project, source_type, source_id, source_version, "HANDED_OFF_TO", target_type or target_domain, target_id or item.id, None, user_id)
    if dependency_analysis and dependency_asset:
        dependency = models.AnalysisAssetDependency(
            id=new_id("dep"), organization_id=project.organizationId, project_id=project.id,
            analysis_id=dependency_analysis.id, scholarly_asset_id=dependency_asset.id,
            analysis_engine_version=dependency_analysis.engine_version,
            dataset_version_id=dependency_analysis.dataset_version_id,
            status="CURRENT", created_at=utc_now(),
        )
        db.add(dependency)
    OutboxService.record_event(
        db, project.organizationId, WorkflowEventType.ACADEMIC_HANDOFF_CREATED,
        AggregateType.ACADEMIC_HANDOFF, item.id,
        EventPayload(
            title_ar="تم إنشاء تسليم أكاديمي", title_en="Academic handoff created",
            message_ar="أصبح مخرج بحثي جاهزًا للمراجعة في المسار التالي.",
            message_en="A research output is ready for review in the next workspace.",
            target_type="RESEARCH_PROJECT", target_id=project.id,
            meta={"handoff_id": item.id, "handoff_type": handoff_type},
        ), actor_user_id=user_id, scope_key=key,
    )
    return item


def accept_handoff(db: Session, handoff: models.AcademicHandoff, user_id: str) -> models.AcademicHandoff:
    if handoff.status == "ACCEPTED":
        return handoff
    if handoff.status != "PENDING":
        raise HTTPException(409, "Only pending handoffs can be accepted")
    handoff.status = "ACCEPTED"
    handoff.accepted_at = utc_now()
    OutboxService.record_event(
        db, handoff.organization_id, WorkflowEventType.ACADEMIC_HANDOFF_ACCEPTED,
        AggregateType.ACADEMIC_HANDOFF, handoff.id,
        EventPayload(
            title_ar="تم قبول التسليم الأكاديمي", title_en="Academic handoff accepted",
            message_ar="تم قبول المخرج في المسار الوجهة.", message_en="The output was accepted by the destination workspace.",
            target_type="RESEARCH_PROJECT", target_id=handoff.project_id,
            meta={"handoff_id": handoff.id, "handoff_type": handoff.handoff_type},
        ), actor_user_id=user_id, scope_key="accepted",
    )
    return handoff


def propagate_dataset_staleness(db: Session, dataset: models.ResearchDataset, new_version_id: str, actor_user_id: str | None) -> int:
    stamp = utc_now()
    analyses = db.query(models.ResearchAnalysis).filter(
        models.ResearchAnalysis.organization_id == dataset.organization_id,
        models.ResearchAnalysis.dataset_id == dataset.id,
        models.ResearchAnalysis.dataset_version_id != new_version_id,
        models.ResearchAnalysis.status == "COMPLETED",
    ).all()
    if not analyses:
        return 0
    analysis_ids = [a.id for a in analyses]
    for analysis in analyses:
        analysis.status = "STALE"
    dependencies = db.query(models.AnalysisAssetDependency).filter(
        models.AnalysisAssetDependency.organization_id == dataset.organization_id,
        models.AnalysisAssetDependency.analysis_id.in_(analysis_ids),
        models.AnalysisAssetDependency.status == "CURRENT",
    ).all()
    for dependency in dependencies:
        dependency.status = "NEEDS_REVIEW"
        dependency.needs_review_at = stamp
    handoffs = db.query(models.AcademicHandoff).filter(
        models.AcademicHandoff.organization_id == dataset.organization_id,
        models.AcademicHandoff.source_entity_type == "ANALYSIS",
        models.AcademicHandoff.source_entity_id.in_(analysis_ids),
        models.AcademicHandoff.status.in_(["PENDING", "ACCEPTED"]),
    ).all()
    for handoff in handoffs:
        handoff.status = "STALE"
        handoff.stale_at = stamp
    OutboxService.record_event(
        db, dataset.organization_id, WorkflowEventType.DATASET_VERSION_CHANGED,
        AggregateType.RESEARCH_DATASET, dataset.id,
        EventPayload(
            title_ar="تغير إصدار بيانات البحث", title_en="Research dataset version changed",
            message_ar="تحتاج النتائج والمخطوطات التابعة إلى مراجعة دون تعديلها تلقائيًا.",
            message_en="Dependent results and manuscripts require review; no content was changed automatically.",
            target_type="RESEARCH_PROJECT", target_id=dataset.project_id,
            meta={"dataset_id": dataset.id, "new_version_id": new_version_id, "stale_analysis_count": len(analyses)},
        ), actor_user_id=actor_user_id, scope_key=new_version_id,
    )
    return len(analyses)
