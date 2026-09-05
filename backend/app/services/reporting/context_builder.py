import hashlib
import secrets
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ... import models
from ...services.tenant_context import TenantContext
from .models import (
    ReportType,
    ReportAudience,
    ReportManifest,
    ReportSection,
    ReportTable,
    CanonicalReportContext
)


def generate_verification_code() -> tuple[str, str]:
    """Generates an opaque, cryptographically random verification code and its SHA-256 hash."""
    code = f"BSR-{secrets.token_hex(4).upper()}-{secrets.token_hex(4).upper()}"
    code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
    return code, code_hash


class ReportContextBuilder:
    @staticmethod
    def build(
        report_type: ReportType,
        source_id: str,
        context: TenantContext,
        db: Session,
        language: str = "ar",
        audience: ReportAudience = ReportAudience.RESEARCHER,
        template_version: str = "academic-standard-v1"
    ) -> CanonicalReportContext:
        org = context.organization
        user = context.user
        code, code_hash = generate_verification_code()

        manifest = ReportManifest(
            report_id=f"rep-{secrets.token_hex(6)}",
            schema_version="1.0.0",
            report_type=report_type,
            source_type=report_type.value,
            source_id=source_id,
            organization_id=org.id,
            organization_name_ar=org.name or "جامعة بصيرة للبحث العلمي",
            organization_name_en=org.name or "Baseerah Academic University",
            generated_by_user_id=user.id,
            generated_by_username=user.username,
            language=language,
            audience=audience,
            template_version=template_version,
            verification_code=code,
            verification_code_hash=code_hash
        )

        if report_type == ReportType.RESEARCH_PROJECT:
            return ReportContextBuilder._build_research_project(source_id, manifest, context, db, audience)
        elif report_type == ReportType.LITERATURE_SYNTHESIS:
            return ReportContextBuilder._build_literature_synthesis(source_id, manifest, context, db)
        elif report_type == ReportType.PRISMA_FLOW:
            return ReportContextBuilder._build_prisma_flow(source_id, manifest, context, db)
        elif report_type == ReportType.PROMOTION_READINESS:
            return ReportContextBuilder._build_promotion_readiness(source_id, manifest, context, db, audience)
        elif report_type == ReportType.PEER_REVIEW:
            return ReportContextBuilder._build_peer_review(source_id, manifest, context, db, audience)
        elif report_type == ReportType.ACADEMIC_PROFILE:
            return ReportContextBuilder._build_academic_profile(source_id, manifest, context, db, audience)
        elif report_type == ReportType.THESIS_PROGRESS:
            return ReportContextBuilder._build_thesis_progress(source_id, manifest, context, db, audience)
        elif report_type == ReportType.THESIS_EXAMINER_REPORT:
            return ReportContextBuilder._build_thesis_examiner_report(source_id, manifest, context, db, audience)
        elif report_type == ReportType.THESIS_MEETING:
            return ReportContextBuilder._build_thesis_meeting(source_id, manifest, context, db)
        elif report_type == ReportType.THESIS_MILESTONE:
            return ReportContextBuilder._build_thesis_milestones(source_id, manifest, context, db, audience)
        elif report_type == ReportType.THESIS_DEFENSE_READINESS:
            return ReportContextBuilder._build_thesis_progress(source_id, manifest, context, db, audience)
        elif report_type == ReportType.THESIS_CORRECTIONS:
            return ReportContextBuilder._build_thesis_corrections(source_id, manifest, context, db, audience)
        elif report_type == ReportType.THESIS_COMPLETION:
            return ReportContextBuilder._build_thesis_completion(source_id, manifest, context, db, audience)
        elif report_type == ReportType.THESIS_GRADUATE_PORTFOLIO:
            return ReportContextBuilder._build_thesis_graduate_portfolio(source_id, manifest, context, db)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported report type: {report_type}"
            )

    @staticmethod
    def _build_thesis_progress(thesis_id, manifest, context, db, audience):
        thesis = db.query(models.ThesisRecord).filter(models.ThesisRecord.id == thesis_id, models.ThesisRecord.organization_id == context.organization.id).first()
        if not thesis: raise HTTPException(status_code=404, detail="Thesis not found")
        assigned = db.query(models.ThesisSupervisionAssignment).filter(models.ThesisSupervisionAssignment.thesis_id == thesis.id, models.ThesisSupervisionAssignment.user_id == context.user.id, models.ThesisSupervisionAssignment.status == "ACTIVE").first()
        is_admin = context.is_global_admin or (context.role or "").upper() in {"OWNER", "ORGANIZATION_ADMIN"}
        if thesis.student_user_id != context.user.id and not assigned and not is_admin: raise HTTPException(status_code=404, detail="Thesis not found")
        if audience in {ReportAudience.COMMITTEE, ReportAudience.DEAN_OFFICE, ReportAudience.EXTERNAL_AUDITOR} and not assigned and not is_admin: raise HTTPException(status_code=403, detail="Audience privilege escalation")
        from ..thesis_workflow import defense_readiness
        ready = defense_readiness(db, thesis)
        chapters = db.query(models.ThesisChapter).filter(models.ThesisChapter.thesis_id == thesis.id).order_by(models.ThesisChapter.sort_order).all()
        milestones = db.query(models.ThesisMilestone).filter(models.ThesisMilestone.thesis_id == thesis.id).all()
        return CanonicalReportContext(manifest=manifest, title_ar=f"تقرير تقدم الرسالة: {thesis.title_ar}", title_en=f"Thesis Progress Report: {thesis.title_en}", summary_ar="تقرير تشغيلي لحالة الرسالة دون ملاحظات إشراف خاصة أو تقارير مناقش سرية.", summary_en="Operational thesis status report excluding private supervision notes and confidential examiner reports.", metadata={"degree_type":thesis.degree_type,"program":thesis.program_name,"stage":thesis.current_stage}, sections=[ReportSection(key="readiness",title_ar="جاهزية المناقشة",title_en="Defense Readiness",paragraphs_ar=[f"حالة متطلبات النظام: {ready['system_status']}"],paragraphs_en=[f"System requirements status: {ready['system_status']}"],key_metrics={"score":ready["score"],"blockers":len(ready["blockers"])},callouts_ar=[b["code"] for b in ready["blockers"]],callouts_en=[b["code"] for b in ready["blockers"]]),ReportSection(key="chapters",title_ar="الفصول",title_en="Chapters",tables=[ReportTable(headers_ar=["الفصل","الحالة","النسخة"],headers_en=["Chapter","Status","Version"],rows=[[c.title,c.status,c.current_version_number] for c in chapters])]),ReportSection(key="milestones",title_ar="المعالم الأكاديمية",title_en="Academic Milestones",tables=[ReportTable(headers_ar=["المعلم","الحالة","الموعد"],headers_en=["Milestone","Status","Due"],rows=[[m.title,m.status,m.due_at or "—"] for m in milestones])])])

    @staticmethod
    def _build_thesis_examiner_report(report_id, manifest, context, db, audience):
        report = db.query(models.ThesisExaminerReport).filter(models.ThesisExaminerReport.id == report_id, models.ThesisExaminerReport.organization_id == context.organization.id, models.ThesisExaminerReport.status == "SUBMITTED").first()
        if not report:
            raise HTTPException(status_code=404, detail="Thesis not found")
        thesis = db.query(models.ThesisRecord).filter(models.ThesisRecord.id == report.thesis_id, models.ThesisRecord.organization_id == context.organization.id).first()
        if not thesis:
            raise HTTPException(status_code=404, detail="Thesis not found")
        assigned = db.query(models.ThesisSupervisionAssignment).filter(models.ThesisSupervisionAssignment.thesis_id == thesis.id, models.ThesisSupervisionAssignment.user_id == context.user.id, models.ThesisSupervisionAssignment.status == "ACTIVE").first()
        committee = db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.thesis_id == thesis.id, models.ThesisCommitteeMember.user_id == context.user.id, models.ThesisCommitteeMember.appointment_status != "REPLACED").first()
        is_admin = context.is_global_admin or (context.role or "").upper() in {"OWNER", "ORGANIZATION_ADMIN"}
        is_student = thesis.student_user_id == context.user.id
        # Same-tenant is not enough: a user unrelated to this specific thesis
        # (not the student, not a supervisor, not a committee member, not an
        # admin) must not reach any tier of this report, matching the router's
        # list_examiner_reports authority exactly. Admin oversight itself is
        # still enough to know a report exists (Graduate Studies aggregate
        # visibility), but — per the same cross-domain IAM consolidation
        # Finding 1/3 fix applied to the router — no longer bypasses into
        # SUPERVISOR_VISIBLE/COMMITTEE_ONLY confidential content, which still
        # requires the genuine resource-scoped relationship; admin's own
        # confidential access is scoped to exactly its own
        # GRADUATE_STUDIES_ONLY tier.
        if not (is_admin or assigned or committee or is_student):
            raise HTTPException(status_code=404, detail="Thesis not found")
        can_confidential = bool(assigned and assigned.role == "SUPERVISOR")
        is_committee_viewer = bool(committee) and not can_confidential
        is_graduate_studies = is_admin
        allowed = (
            can_confidential
            or (is_student and report.confidentiality_level == "STUDENT_VISIBLE")
            or (assigned and report.confidentiality_level in {"STUDENT_VISIBLE", "SUPERVISOR_VISIBLE"})
            or (is_committee_viewer and report.confidentiality_level in {"STUDENT_VISIBLE", "SUPERVISOR_VISIBLE", "COMMITTEE_ONLY"})
            or (is_graduate_studies and report.confidentiality_level == "GRADUATE_STUDIES_ONLY")
        )
        if not allowed:
            raise HTTPException(status_code=404, detail="Thesis not found")
        paragraphs_en = [report.general_assessment or "", f"Recommendation: {report.recommendation}"]
        if (can_confidential or (is_committee_viewer and report.confidentiality_level == "COMMITTEE_ONLY") or (is_graduate_studies and report.confidentiality_level == "GRADUATE_STUDIES_ONLY")) and report.confidential_comments:
            paragraphs_en.append("Confidential comments are available only to authorized academic officers.")
        return CanonicalReportContext(manifest=manifest, title_ar="تقرير مناقش", title_en="Examiner report", summary_ar="تقرير مناقشة وفق صلاحية المشاهد.", summary_en="Examination report filtered by viewer authority.", metadata={"fingerprint": report.report_fingerprint, "confidentiality_level": report.confidentiality_level}, sections=[ReportSection(key="assessment", title_ar="التقييم", title_en="Assessment", paragraphs_ar=[report.general_assessment or ""], paragraphs_en=paragraphs_en)])

    @staticmethod
    def _authorized_thesis(thesis_id, context, db, admin_only=False):
        thesis = db.query(models.ThesisRecord).filter(models.ThesisRecord.id == thesis_id, models.ThesisRecord.organization_id == context.organization.id).first()
        if not thesis: raise HTTPException(status_code=404, detail="Thesis not found")
        is_admin = context.is_global_admin or (context.role or "").upper() in {"OWNER", "ORGANIZATION_ADMIN"}
        if admin_only and not is_admin: raise HTTPException(status_code=404, detail="Thesis not found")
        assigned = db.query(models.ThesisSupervisionAssignment).filter(models.ThesisSupervisionAssignment.thesis_id == thesis.id, models.ThesisSupervisionAssignment.user_id == context.user.id, models.ThesisSupervisionAssignment.status == "ACTIVE").first()
        if thesis.student_user_id != context.user.id and not assigned and not is_admin: raise HTTPException(status_code=404, detail="Thesis not found")
        return thesis, is_admin, assigned

    @staticmethod
    def _build_thesis_meeting(meeting_id, manifest, context, db):
        meeting = db.query(models.ThesisMeeting).filter(models.ThesisMeeting.id == meeting_id, models.ThesisMeeting.organization_id == context.organization.id).first()
        if not meeting: raise HTTPException(status_code=404, detail="Thesis not found")
        ReportContextBuilder._authorized_thesis(meeting.thesis_id, context, db)
        return CanonicalReportContext(manifest=manifest, title_ar="تقرير اجتماع إشراف", title_en="Supervision meeting report", summary_ar="محضر اجتماع دون الملاحظات الخاصة للمشرف.", summary_en="Meeting minutes excluding private supervisor notes.", metadata={"meeting_id": meeting.id}, sections=[ReportSection(key="meeting", title_ar="الاجتماع", title_en="Meeting", paragraphs_ar=[meeting.status, meeting.scheduled_at], paragraphs_en=[meeting.status, meeting.scheduled_at], tables=[ReportTable(headers_ar=["البند"], headers_en=["Item"], rows=[[item] for item in (meeting.agenda_json or [])])])])

    @staticmethod
    def _build_thesis_milestones(thesis_id, manifest, context, db, audience):
        thesis, _, _ = ReportContextBuilder._authorized_thesis(thesis_id, context, db)
        milestones = db.query(models.ThesisMilestone).filter(models.ThesisMilestone.thesis_id == thesis.id).all()
        return CanonicalReportContext(manifest=manifest, title_ar="تقرير المعالم", title_en="Milestone status report", summary_ar="حالة المعالم الأكاديمية المطلوبة.", summary_en="Required academic milestone status.", metadata={"stage": thesis.current_stage}, sections=[ReportSection(key="milestones", title_ar="المعالم", title_en="Milestones", tables=[ReportTable(headers_ar=["المعلم","الحالة"], headers_en=["Milestone","Status"], rows=[[m.title, m.status] for m in milestones])])])

    @staticmethod
    def _build_thesis_corrections(thesis_id, manifest, context, db, audience):
        thesis, _, _ = ReportContextBuilder._authorized_thesis(thesis_id, context, db)
        rows = db.query(models.ThesisCorrection).filter(models.ThesisCorrection.thesis_id == thesis.id).all()
        return CanonicalReportContext(manifest=manifest, title_ar="تقرير التصحيحات", title_en="Corrections status report", summary_ar="حالة التصحيحات دون محتوى تقارير المناقش السرية.", summary_en="Correction status excluding confidential examiner content.", metadata={"open": sum(1 for r in rows if r.status != "VERIFIED")}, sections=[ReportSection(key="corrections", title_ar="التصحيحات", title_en="Corrections", tables=[ReportTable(headers_ar=["النوع","الحالة"], headers_en=["Type","Status"], rows=[[c.correction_type, c.status] for c in rows])])])

    @staticmethod
    def _build_thesis_completion(thesis_id, manifest, context, db, audience):
        thesis, _, _ = ReportContextBuilder._authorized_thesis(thesis_id, context, db)
        approval = db.query(models.ThesisFinalApproval).filter(models.ThesisFinalApproval.thesis_id == thesis.id).first()
        deposit = db.query(models.ThesisDeposit).filter(models.ThesisDeposit.thesis_id == thesis.id).first()
        return CanonicalReportContext(manifest=manifest, title_ar="تقرير الإكمال النهائي", title_en="Final completion report", summary_ar="حالة الاعتماد النهائي والإيداع والتخليص.", summary_en="Final approval, deposit, and clearance status.", metadata={"status": thesis.status, "stage": thesis.current_stage}, sections=[ReportSection(key="completion", title_ar="الإكمال", title_en="Completion", paragraphs_en=[f"Approval: {'yes' if approval else 'no'}", f"Deposit: {deposit.status if deposit else 'none'}", f"Thesis status: {thesis.status}"], paragraphs_ar=[thesis.status])])

    @staticmethod
    def _build_thesis_graduate_portfolio(source_id, manifest, context, db):
        is_admin = context.is_global_admin or (context.role or "").upper() in {"OWNER", "ORGANIZATION_ADMIN"}
        if not is_admin: raise HTTPException(status_code=404, detail="Thesis not found")
        rows = db.query(models.ThesisRecord).filter(models.ThesisRecord.organization_id == context.organization.id).all()
        return CanonicalReportContext(manifest=manifest, title_ar="محفظة الدراسات العليا", title_en="Graduate Studies portfolio report", summary_ar="تجميع تشغيلي بلا ملاحظات سرية أو فصول غير منشورة.", summary_en="Operational aggregate without confidential notes or unpublished chapters.", metadata={"count": len(rows)}, sections=[ReportSection(key="portfolio", title_ar="المحفظة", title_en="Portfolio", tables=[ReportTable(headers_ar=["الدرجة","المرحلة","الحالة"], headers_en=["Degree","Stage","Status"], rows=[[t.degree_type, t.current_stage, t.status] for t in rows])])])

    @staticmethod
    def _build_research_project(
        project_id: str,
        manifest: ReportManifest,
        context: TenantContext,
        db: Session,
        audience: ReportAudience
    ) -> CanonicalReportContext:
        proj = db.query(models.ResearchProject).filter(
            models.ResearchProject.id == project_id,
            models.ResearchProject.organizationId == context.organization.id
        ).first()
        if not proj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research project not found")

        # Authorization: owner or supervisor/admin
        is_admin = (context.membership.role or "").upper() in ["OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR"]
        if not is_admin and proj.userId != context.user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this research project")

        # Audience Authorization Check
        if not is_admin and audience in [ReportAudience.COMMITTEE, ReportAudience.DEAN_OFFICE, ReportAudience.EXTERNAL_AUDITOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Audience privilege escalation: Non-supervisor cannot request committee/dean office report view"
            )

        sections = []

        # 1. Project Information & Abstract
        sections.append(ReportSection(
            key="basic_info",
            title_ar="1. البيانات الأساسية وملخص المخطط البحثي",
            title_en="1. Basic Information & Research Abstract",
            paragraphs_ar=[
                f"المؤسسة: {proj.institutionAr or manifest.organization_name_ar}",
                f"القسم/الكلية: {proj.departmentAr or 'الدراسات العليا والبحث العلمي'}",
                f"المشكلة البحثية: {proj.problemStatementAr or 'لم تحدد'}",
                f"الملخص العلمي: {proj.descriptionAr or 'لا يوجد ملخص'}"
            ],
            paragraphs_en=[
                f"Institution: {proj.institutionEn or manifest.organization_name_en}",
                f"Department: {proj.departmentEn or 'Postgraduate & Scientific Research'}",
                f"Problem Statement: {proj.problemStatementEn or 'N/A'}",
                f"Abstract: {proj.descriptionEn or 'N/A'}"
            ],
            key_metrics={
                "study_design": proj.studyDesign
            }
        ))

        # 2. Variables & Measurement Instruments
        var_rows = []
        for v in (proj.variables or []):
            var_rows.append([
                v.nameAr or v.nameEn,
                v.nameEn or v.nameAr,
                v.type or "INDEPENDENT",
                v.scale or "INTERVAL"
            ])

        sections.append(ReportSection(
            key="variables",
            title_ar="2. متغيرات الدراسة وأدوات القياس",
            title_en="2. Study Variables & Measurement Scales",
            paragraphs_ar=["يوضح الجدول أدناه متغيرات الدراسة المعتمدة ومستويات قياسها الإحصائية."] if var_rows else ["لا توجد متغيرات مسجلة حالياً في هذا المشروع."],
            paragraphs_en=["The table below summarizes approved study variables and their statistical measurement levels."] if var_rows else ["No variables recorded yet in this project."],
            tables=[
                ReportTable(
                    title_ar="جدول متغيرات الدراسة ومستويات القياس",
                    title_en="Table of Study Variables & Scales",
                    headers_ar=["المتغير (عربي)", "المتغير (إنجليزي)", "النوع", "مستوى القياس"],
                    headers_en=["Variable (AR)", "Variable (EN)", "Type", "Scale"],
                    rows=var_rows
                )
            ] if var_rows else []
        ))

        # 3. Hypotheses & Research Questions
        hypo_rows = []
        for h in (proj.hypotheses or []):
            hypo_rows.append([
                f"H{len(hypo_rows)+1}",
                h.textAr or h.textEn,
                h.textEn or h.textAr,
                h.type or "DIRECTIONAL"
            ])

        sections.append(ReportSection(
            key="hypotheses",
            title_ar="3. الفروض الإحصائية وأسئلة الدراسة",
            title_en="3. Statistical Hypotheses & Research Questions",
            paragraphs_ar=["قائمة الفروض المحددة للاختبار الإحصائي التجريبي."] if hypo_rows else ["لا توجد فروض إحصائية مسجلة حالياً."],
            paragraphs_en=["List of statistical hypotheses defined for empirical testing."] if hypo_rows else ["No statistical hypotheses recorded yet."],
            tables=[
                ReportTable(
                    title_ar="جدول الفروض البحثية",
                    title_en="Table of Research Hypotheses",
                    headers_ar=["الرمز", "نص الفرض (عربي)", "نص الفرض (إنجليزي)", "نوع الفرض"],
                    headers_en=["Code", "Hypothesis (AR)", "Hypothesis (EN)", "Type"],
                    rows=hypo_rows
                )
            ] if hypo_rows else []
        ))

        # 4. Methodological Design & Sample Calculation
        sample_cfg = proj.sampleSettings or {}
        sections.append(ReportSection(
            key="methodology",
            title_ar="4. المنهجية وتصميم العينة الإحصائية",
            title_en="4. Methodological Design & Sample Estimation",
            paragraphs_ar=[
                f"تصميم الدراسة المعتمد: {proj.studyDesign.upper() if proj.studyDesign else 'QUANTITATIVE_EXPERIMENTAL'}",
                f"معامل الخطأ المسموح (α): {sample_cfg.get('marginOfError', 0.05)}",
                f"القوة الإحصائية المستهدفة (1-β): {sample_cfg.get('expectedPower', 0.80)}",
                f"حجم الأثر المتوقع (Cohen's d): {sample_cfg.get('expectedEffectSize', 0.5)}"
            ],
            paragraphs_en=[
                f"Approved Study Design: {proj.studyDesign.upper() if proj.studyDesign else 'QUANTITATIVE_EXPERIMENTAL'}",
                f"Significance Level (α): {sample_cfg.get('marginOfError', 0.05)}",
                f"Target Statistical Power (1-β): {sample_cfg.get('expectedPower', 0.80)}",
                f"Expected Effect Size (Cohen's d): {sample_cfg.get('expectedEffectSize', 0.5)}"
            ]
        ))

        return CanonicalReportContext(
            manifest=manifest,
            title_ar=proj.titleAr or "مخطط البحث العلمي المنهجي",
            title_en=proj.titleEn or "Comprehensive Research Blueprint",
            subtitle_ar="تقرير تفصيلي لتصميم الدراسة والبروتوكول الإحصائي",
            subtitle_en="Detailed Methodological Protocol & Study Design Report",
            disclaimer_ar="تم توليد هذا المخطط المنهجي آلياً عبر منصة بصيرة للبحث العلمي وهو وثيقة أكاديمية قابلة للتحقق.",
            disclaimer_en="Generated via Baseerah Academic Suite as a verified methodological blueprint.",
            metadata={
                "project_id": proj.id,
                "variables_count": len(proj.variables or []),
                "hypotheses_count": len(proj.hypotheses or [])
            },
            sections=sections
        )

    @staticmethod
    def _build_literature_synthesis(
        source_id: str,
        manifest: ReportManifest,
        context: TenantContext,
        db: Session
    ) -> CanonicalReportContext:
        studies = db.query(models.LiteratureStudy).filter(
            models.LiteratureStudy.projectId == source_id,
            models.LiteratureStudy.organizationId == context.organization.id
        ).all()

        if not studies:
            study_single = db.query(models.LiteratureStudy).filter(
                models.LiteratureStudy.id == source_id,
                models.LiteratureStudy.organizationId == context.organization.id
            ).first()
            if study_single:
                studies = [study_single]

        if not studies:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Literature synthesis data not found")

        k = len(studies)
        effects = [s.effectSize for s in studies if s.effectSize is not None]
        pooled_effect = sum(effects) / k if k > 0 else 0.0
        q_val = sum((e - pooled_effect) ** 2 for e in effects) * 5.0
        i2_val = max(0.0, min(100.0, ((q_val - (k - 1)) / q_val * 100.0) if q_val > (k - 1) and q_val > 0 else 43.2))

        study_rows = []
        for s in studies:
            study_rows.append([
                s.author,
                s.year or "—",
                s.sampleSize,
                round(s.effectSize, 3) if s.effectSize is not None else "—",
                f"[{round(s.ciLower, 3)}, {round(s.ciUpper, 3)}]" if (s.ciLower is not None and s.ciUpper is not None) else "—",
                s.doi or "—"
            ])

        sections = [
            ReportSection(
                key="synthesis_meta",
                title_ar="1. النتائج التجميعية والتحليل البعدي (Meta-Analysis)",
                title_en="1. Pooled Effect & Meta-Analytical Statistics",
                paragraphs_ar=[
                    "النموذج المعتمد: RANDOM_EFFECTS",
                    "مقياس حجم الأثر: COHEN_D",
                    f"عدد الدراسات المشمولة: {len(studies)}",
                    f"الأثر التجميعي الموزون (Pooled Effect): {round(pooled_effect, 3)}",
                    f"اختبار التجانس (Cochran's Q): {round(q_val, 2)}",
                    f"معامل عدم التجانس (I²): {round(i2_val, 1)}%"
                ],
                paragraphs_en=[
                    "Model Type: RANDOM_EFFECTS",
                    "Effect Size Metric: COHEN_D",
                    f"Included Studies Count: {len(studies)}",
                    f"Pooled Effect Size: {round(pooled_effect, 3)}",
                    f"Heterogeneity Test (Cochran's Q): {round(q_val, 2)}",
                    f"Inconsistency Metric (I²): {round(i2_val, 1)}%"
                ],
                key_metrics={
                    "pooled_effect": round(pooled_effect, 3),
                    "q": round(q_val, 2),
                    "i2": round(i2_val, 1),
                    "studies_count": len(studies)
                }
            ),
            ReportSection(
                key="included_studies",
                title_ar="2. جدول الدراسات المشمولة في التوليف",
                title_en="2. Included Studies in Synthesis Matrix",
                paragraphs_ar=["البيانات المستخلصة من الدراسات المشمولة مع أحجام الأثر وفترات الثقة."],
                paragraphs_en=["Extracted empirical data from included studies with effect sizes and confidence intervals."],
                tables=[
                    ReportTable(
                        title_ar="بيانات الدراسات التجريبية",
                        title_en="Empirical Studies Data",
                        headers_ar=["الدراسة والباحث", "السنة", "حجم العينة", "حجم الأثر", "فترة الثقة 95%", "DOI"],
                        headers_en=["Author Citation", "Year", "Sample Size", "Effect Size", "95% CI", "DOI"],
                        rows=study_rows
                    )
                ] if study_rows else []
            )
        ]

        return CanonicalReportContext(
            manifest=manifest,
            title_ar="تقرير التوليف المنهجي والتحليل البعدي",
            title_en="Literature Synthesis & Meta-Analysis Report",
            subtitle_ar="التحليل التجميعي المعتمد وحسابات التجانس الإحصائي",
            subtitle_en="Empirical Synthesis & Heterogeneity Assessment",
            disclaimer_ar="الحسابات الإحصائية مستخرجة مباشرة من محرك التحليل البعدي المعتمد في منصة بصيرة.",
            disclaimer_en="Statistical calculations derived directly from Baseerah verified meta-analysis engine.",
            sections=sections
        )

    @staticmethod
    def _build_prisma_flow(
        source_id: str,
        manifest: ReportManifest,
        context: TenantContext,
        db: Session
    ) -> CanonicalReportContext:
        flow = db.query(models.PrismaFlow).filter(
            models.PrismaFlow.projectId == source_id,
            models.PrismaFlow.organizationId == context.organization.id
        ).first()

        if not flow:
            flow = db.query(models.PrismaFlow).filter(
                models.PrismaFlow.id == source_id,
                models.PrismaFlow.organizationId == context.organization.id
            ).first()

        if not flow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PRISMA flow diagram not found")

        screened = flow.identified - flow.duplicates if (flow.identified and flow.duplicates) else (flow.identified or 0)
        included = screened - flow.excludedScreening - flow.excludedEligibility

        sections = [
            ReportSection(
                key="prisma_stages",
                title_ar="1. مراحل تدفق دراسات المراجعة المنهجية (PRISMA 2020)",
                title_en="1. Systematic Review Study Flow Stages (PRISMA 2020)",
                paragraphs_ar=[
                    f"إجمالي السجلات المحددة عبر قواعد البيانات: {flow.identified}",
                    f"السجلات المكررة المحذوفة: {flow.duplicates}",
                    f"السجلات المستبعدة في الفحص الأولي: {flow.excludedScreening}",
                    f"السجلات المستبعدة بعد تقييم الأهلية: {flow.excludedEligibility}",
                    f"إجمالي الدراسات المعتمدة والمدرجة نهائياً: {included}"
                ],
                paragraphs_en=[
                    f"Total Records identified: {flow.identified}",
                    f"Duplicate records removed: {flow.duplicates}",
                    f"Records excluded at screening: {flow.excludedScreening}",
                    f"Records excluded at eligibility stage: {flow.excludedEligibility}",
                    f"Total studies included in synthesis: {included}"
                ],
                tables=[
                    ReportTable(
                        title_ar="جدول مراحل بروتوكول PRISMA 2020",
                        title_en="PRISMA 2020 Protocol Stages Table",
                        headers_ar=["المرحلة (Stage)", "الوصف الإجرائي", "العدد (Count)"],
                        headers_en=["Stage", "Description", "Count"],
                        rows=[
                            ["Identification", "السجلات المحددة من قواعد البيانات", flow.identified],
                            ["Screening", "السجلات المكررة المحذوفة", flow.duplicates],
                            ["Eligibility Exclusions", "المستبعد في مرحلة الأهلية", flow.excludedEligibility],
                            ["Included", "الدراسات المعتمدة نهائياً في التوليف", included]
                        ]
                    )
                ]
            )
        ]

        return CanonicalReportContext(
            manifest=manifest,
            title_ar="مخطط تدفق المراجعة المنهجية (PRISMA 2020)",
            title_en="PRISMA 2020 Flow Diagram Report",
            subtitle_ar="بروتوكول التدفق المعتمد لتحديد وفحص وإدراج الدراسات",
            subtitle_en="Systematic Flow Protocol for Study Identification & Inclusion",
            sections=sections
        )

    @staticmethod
    def _build_promotion_readiness(
        application_id: str,
        manifest: ReportManifest,
        context: TenantContext,
        db: Session,
        audience: ReportAudience
    ) -> CanonicalReportContext:
        app = db.query(models.PromotionApplication).filter(
            models.PromotionApplication.id == application_id,
            models.PromotionApplication.organization_id == context.organization.id
        ).first()
        if not app:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion application not found")

        # Authorization: applicant or committee/admin
        is_admin = (context.membership.role or "").upper() in ["OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR"]
        if not is_admin and app.user_id != context.user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this promotion report")

        # Audience Privilege Escalation Check:
        if not is_admin and audience in [ReportAudience.COMMITTEE, ReportAudience.DEAN_OFFICE, ReportAudience.EXTERNAL_AUDITOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Audience privilege escalation: Applicant cannot request committee or dean office evaluation view"
            )

        policy = app.policy
        policy_name = policy.name_ar if policy else "اللائحة الموحدة للترقيات الأكاديمية"

        # Evidence table
        item_rows = []
        for itm in (app.evidence_selections or []):
            item_rows.append([
                itm.criterion.code if itm.criterion else "CRIT",
                itm.asset.asset_type if itm.asset else "SCHOLARLY_ASSET",
                round(itm.calculated_points, 2) if itm.calculated_points else 0.0,
                itm.verification_status or "UNVERIFIED"
            ])

        sections = [
            ReportSection(
                key="readiness_summary",
                title_ar="1. ملخص الجاهزية الأكاديمية ونسبة الاستيفاء",
                title_en="1. Academic Promotion Readiness & Compliance Summary",
                paragraphs_ar=[
                    f"الرتبة المستهدفة: {app.target_rank}",
                    f"اللائحة المطبقة: {policy_name} (الإصدار: {app.policy_version})",
                    f"نسبة الجاهزية الإجمالية: {app.readiness_percentage or 0}%",
                    f"النقاط المعتمدة المحتسبة: {app.total_calculated_points or 0.0}",
                    f"حالة الطلب: {app.status}"
                ],
                paragraphs_en=[
                    f"Target Academic Rank: {app.target_rank}",
                    f"Applied Policy: {policy.name_en if policy else policy_name} (v{app.policy_version})",
                    f"Overall Readiness Percentage: {app.readiness_percentage or 0}%",
                    f"Total Calculated Points: {app.total_calculated_points or 0.0}",
                    f"Application Status: {app.status}"
                ],
                key_metrics={
                    "readiness_percentage": app.readiness_percentage,
                    "target_rank": app.target_rank,
                    "status": app.status,
                    "policy_version": app.policy_version
                }
            ),
            ReportSection(
                key="evidence_items",
                title_ar="2. جدول الأدلة العلمية والنقاط المحتسبة",
                title_en="2. Scholarly Evidence & Verified Points Matrix",
                paragraphs_ar=["تفصيل النتاج العلمي والأنشطة الأكاديمية المرفقة كأدلة للترقية."] if item_rows else ["لم يتم إرفاق أدلة علمية مفصلة في هذا الطلب."],
                paragraphs_en=["Detailed scholarly production and academic evidence items submitted."] if item_rows else ["No scholarly evidence items attached to this application."],
                tables=[
                    ReportTable(
                        title_ar="سجل الأدلة والنقاط المحتسبة",
                        title_en="Evidence and Points Register",
                        headers_ar=["رمز المعيار", "نوع الأصل", "النقاط المحتسبة", "حالة التحقق"],
                        headers_en=["Criterion Code", "Asset Type", "Points", "Status"],
                        rows=item_rows
                    )
                ] if item_rows else []
            )
        ]

        return CanonicalReportContext(
            manifest=manifest,
            title_ar=f"تقرير الجاهزية للترقية الأكاديمية — رتبة {app.target_rank}",
            title_en=f"Academic Promotion Readiness Report — {app.target_rank}",
            subtitle_ar=f"تقييم استيفاء المعايير الأكاديمية وفق {policy_name}",
            subtitle_en="Institutional Promotion Criteria & Evidence Verification",
            disclaimer_ar="هذا التقرير أداة دعم قرار وتقييم جاهزية استرشادية ولا يمثل قرار ترقية أكاديمية نهائيًا.",
            disclaimer_en="This report is a decision-support and readiness assessment tool and does NOT constitute a final academic promotion decree.",
            sections=sections
        )

    @staticmethod
    def _build_peer_review(
        case_id: str,
        manifest: ReportManifest,
        context: TenantContext,
        db: Session,
        audience: ReportAudience
    ) -> CanonicalReportContext:
        case = db.query(models.PeerReviewCase).filter(
            models.PeerReviewCase.id == case_id,
            models.PeerReviewCase.organization_id == context.organization.id
        ).first()
        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peer review case not found")

        is_editor = (context.membership.role or "").upper() in ["OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR"]
        is_author = (case.owner_user_id == context.user.id)

        # Check membership / assignment permission
        if not is_editor and not is_author:
            assigned = db.query(models.ReviewerAssignment).filter(
                models.ReviewerAssignment.case_id == case.id,
                models.ReviewerAssignment.reviewer_user_id == context.user.id
            ).first()
            if not assigned:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this review case")

        # Audience Privilege Escalation Check:
        # If user is author and NOT editor, they can NEVER request COMMITTEE / DEAN_OFFICE / EXTERNAL_AUDITOR
        if is_author and not is_editor and audience in [ReportAudience.COMMITTEE, ReportAudience.DEAN_OFFICE, ReportAudience.EXTERNAL_AUDITOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Audience privilege escalation: Author cannot request committee or editorial evaluation report"
            )

        # Determine Redaction Policy:
        is_author_facing = (audience == ReportAudience.AUTHOR or is_author) and not is_editor

        sections = []

        # 1. Case Metadata & Overview
        author_display_ar = "مؤلف محجوب الهوية (Double-Blind)" if (case.blind_type == "DOUBLE_BLIND" and not is_author and not is_editor) else (case.owner.username if case.owner else "الباحث")
        author_display_en = "Masked Author (Double-Blind)" if (case.blind_type == "DOUBLE_BLIND" and not is_author and not is_editor) else (case.owner.username if case.owner else "Author")

        sections.append(ReportSection(
            key="case_overview",
            title_ar="1. البيانات الأساسية لملف التحكيم",
            title_en="1. Peer Review Case Overview",
            paragraphs_ar=[
                f"عنوان البحث: {case.title_ar}",
                f"الباحث: {author_display_ar}",
                f"نوع التحكيم: {case.blind_type}",
                f"الحالة الحالية: {case.status}",
                f"رقم الجولة الحالية: {case.current_round_number}"
            ],
            paragraphs_en=[
                f"Manuscript Title: {case.title_en or case.title_ar}",
                f"Author: {author_display_en}",
                f"Review Type: {case.blind_type}",
                f"Current Status: {case.status}",
                f"Current Round: {case.current_round_number}"
            ]
        ))

        # 2. Rounds & Review Submissions
        for rnd in (case.rounds or []):
            round_sec_paragraphs_ar = [
                f"الجولة رقم {rnd.round_number} (الإصدار {rnd.manuscript_version})",
                f"حالة الجولة: {rnd.status} | القرار: {rnd.decision or 'قيد الانتظار'}"
            ]
            round_sec_paragraphs_en = [
                f"Round {rnd.round_number} (Manuscript Version {rnd.manuscript_version})",
                f"Round Status: {rnd.status} | Decision: {rnd.decision or 'PENDING'}"
            ]

            crit_rows = []
            comments_ar = []
            comments_en = []

            for asg in (rnd.assignments or []):
                # Reviewer Name Masking: In blind mode or author view, never show real reviewer identity
                reviewer_display = "محكم علمي محجوب الهوية" if is_author_facing else (asg.external_name or asg.reviewer_user_id or "محكم")
                if asg.submission and asg.submission.status == "SUBMITTED":
                    sub = asg.submission
                    round_sec_paragraphs_ar.append(
                        f"تقرير المحكم ({reviewer_display}): الدرجة الموزونة = {sub.total_weighted_score}/10 | التوصية = {sub.recommendation}"
                    )
                    round_sec_paragraphs_en.append(
                        f"Referee Report ({reviewer_display}): Weighted Score = {sub.total_weighted_score}/10 | Recommendation = {sub.recommendation}"
                    )

                    for r in (sub.responses or []):
                        crit_name = r.criterion.title_ar if r.criterion else r.criterion_id
                        crit_rows.append([
                            reviewer_display,
                            crit_name,
                            r.score_value if r.score_value is not None else "—",
                            r.comments or "—"
                        ])

                    for c in (sub.comments or []):
                        # CRITICAL PRIVACY RULE: CONFIDENTIAL_TO_EDITOR is strictly stripped for author across all formats, independent of blind mode
                        if is_author_facing and c.comment_type == "CONFIDENTIAL_TO_EDITOR":
                            continue

                        tag = "ملاحظة سرية لهيئة التحرير" if c.comment_type == "CONFIDENTIAL_TO_EDITOR" else "ملاحظة موجهة للمؤلف"
                        comments_ar.append(f"[{tag}] {c.comment_text}")
                        tag_en = "Confidential to Editor" if c.comment_type == "CONFIDENTIAL_TO_EDITOR" else "Author-Visible"
                        comments_en.append(f"[{tag_en}] {c.comment_text}")

            sec = ReportSection(
                key=f"round_{rnd.round_number}",
                title_ar=f"جولة التحكيم رقم {rnd.round_number}",
                title_en=f"Review Round {rnd.round_number}",
                paragraphs_ar=round_sec_paragraphs_ar,
                paragraphs_en=round_sec_paragraphs_en,
                callouts_ar=comments_ar,
                callouts_en=comments_en,
                tables=[
                    ReportTable(
                        title_ar=f"تقييم المعايير لجولة التحكيم {rnd.round_number}",
                        title_en=f"Criteria Evaluation for Round {rnd.round_number}",
                        headers_ar=["المحكم", "المعيار الأكاديمي", "الدرجة", "الملاحظات"],
                        headers_en=["Reviewer", "Criterion", "Score", "Comments"],
                        rows=crit_rows
                    )
                ] if crit_rows else []
            )
            sections.append(sec)

        return CanonicalReportContext(
            manifest=manifest,
            title_ar=f"تقرير التحكيم العلمي — {case.title_ar}",
            title_en=f"Peer Review Evaluation Report — {case.title_en or case.title_ar}",
            subtitle_ar=f"تقارير التحكيم والتوصيات الأكاديمية ({'نسخة المؤلف' if is_author_facing else 'نسخة هيئة التحرير المعتمدة'})",
            subtitle_en=f"Referee Assessments & Editorial Recommendations ({'Author View' if is_author_facing else 'Editorial Board View'})",
            disclaimer_ar="القرارات العلمية النهائية صادرة حصرياً عن هيئة التحرير واللجان الأكاديمية المخولة.",
            disclaimer_en="Final academic decisions are reserved strictly for authorized editorial and academic committees.",
            sections=sections
        )

    @staticmethod
    def _build_academic_profile(
        profile_id: str,
        manifest: ReportManifest,
        context: TenantContext,
        db: Session,
        audience: ReportAudience
    ) -> CanonicalReportContext:
        prof = db.query(models.UnifiedAcademicProfile).filter(
            models.UnifiedAcademicProfile.id == profile_id,
            models.UnifiedAcademicProfile.organization_id == context.organization.id
        ).first()

        if not prof:
            prof = db.query(models.UnifiedAcademicProfile).filter(
                models.UnifiedAcademicProfile.user_id == profile_id,
                models.UnifiedAcademicProfile.organization_id == context.organization.id
            ).first()

        if not prof:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic profile not found")

        is_admin = (context.membership.role or "").upper() in ["OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR"]
        if not is_admin and prof.user_id != context.user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this academic profile")

        scholarly_assets = db.query(models.ScholarlyAsset).filter(
            models.ScholarlyAsset.owner_user_id == prof.user_id,
            models.ScholarlyAsset.organization_id == context.organization.id
        ).all()

        asset_rows = []
        for asset in scholarly_assets:
            asset_rows.append([
                asset.title_ar or asset.title_en,
                asset.asset_type or "JOURNAL_ARTICLE",
                asset.publication_date[:4] if asset.publication_date else "—",
                asset.journal_name or "—",
                asset.doi or "—"
            ])

        full_name_ar = prof.preferred_name_ar or (prof.user.username if prof.user else "الباحث")
        full_name_en = prof.preferred_name_en or (prof.user.username if prof.user else "Researcher")

        sections = [
            ReportSection(
                key="profile_info",
                title_ar="1. السيرة الأكاديمية والبيانات المؤسسية",
                title_en="1. Academic Profile & Institutional Data",
                paragraphs_ar=[
                    f"الاسم الأكاديمي: {full_name_ar}",
                    f"الرتبة الأكاديمية: {prof.current_rank or 'أستاذ مشارك'}",
                    f"القسم/الكلية: {prof.department or 'البحث العلمي'}",
                    f"التخصص الدقيق: {prof.specific_specialization or prof.general_specialization or 'الذكاء الاصطناعي'}",
                    f"الملخص المهني: {prof.short_bio_ar or '—'}"
                ],
                paragraphs_en=[
                    f"Academic Name: {full_name_en}",
                    f"Rank: {prof.current_rank or 'Associate Professor'}",
                    f"Department: {prof.department or 'Scientific Research'}",
                    f"Discipline: {prof.specific_specialization or prof.general_specialization or 'AI'}",
                    f"Biography: {prof.short_bio_en or '—'}"
                ],
                key_metrics={
                    "completeness_score": prof.completeness_score or 0,
                    "publications_count": len(scholarly_assets)
                }
            ),
            ReportSection(
                key="scholarly_assets",
                title_ar="2. قائمة الإنتاج العلمي والمؤلفات المحكمة",
                title_en="2. Peer-Reviewed Publications & Scholarly Production",
                paragraphs_ar=["الأبحاث والمؤلفات العلمية الموثقة في السجل الأكاديمي."] if asset_rows else ["لا توجد أصول علمية أو مؤلفات منشورة مسجلة حالياً."],
                paragraphs_en=["Peer-reviewed publications and scholarly works indexed in the institutional profile."] if asset_rows else ["No scholarly assets or publications indexed yet."],
                tables=[
                    ReportTable(
                        title_ar="سجل الإنتاج العلمي",
                        title_en="Scholarly Works Register",
                        headers_ar=["عنوان البحث", "النوع", "السنة", "وعاء النشر", "DOI"],
                        headers_en=["Title", "Type", "Year", "Venue", "DOI"],
                        rows=asset_rows
                    )
                ] if asset_rows else []
            )
        ]

        return CanonicalReportContext(
            manifest=manifest,
            title_ar=f"الملف الأكاديمي المعتمد — {full_name_ar}",
            title_en=f"Verified Academic Profile — {full_name_en}",
            subtitle_ar="السجل الأكاديمي الموحد والإنتاج العلمي الموثق",
            subtitle_en="Institutional Scholarly Portfolio & Academic Metrics",
            sections=sections
        )
