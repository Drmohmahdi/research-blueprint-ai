import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from ... import models
from .events import WorkflowEventType, AggregateType

logger = logging.getLogger(__name__)


class ResolvedRecipient:
    def __init__(self, user_id: str, email: Optional[str] = None, role: Optional[str] = None):
        self.user_id = user_id
        self.email = email
        self.role = role


class RecipientResolver:
    @staticmethod
    def resolve_recipients(
        db: Session,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        organization_id: str,
        actor_user_id: Optional[str] = None,
        payload_meta: Optional[dict] = None
    ) -> List[ResolvedRecipient]:
        """
        Deterministically and securely resolves authorized recipient users purely server-side
        from domain relationships, workflow state, and tenant memberships.
        Never trusts client-supplied recipient lists.
        """
        recipients: List[ResolvedRecipient] = []
        payload_meta = payload_meta or {}

        # -------------------------------------------------------------
        # 1. PROMOTION ENGINE EVENTS
        # -------------------------------------------------------------
        if aggregate_type == AggregateType.PROMOTION_APPLICATION.value:
            app = db.query(models.PromotionApplication).filter(
                models.PromotionApplication.id == aggregate_id,
                models.PromotionApplication.organization_id == organization_id
            ).first()

            if not app:
                logger.warning(f"RecipientResolver: PromotionApplication {aggregate_id} not found in org {organization_id}")
                return []

            if event_type == WorkflowEventType.PROMOTION_APPLICATION_SUBMITTED.value:
                # Notify Organization Admins and Committee Members (excluding applicant)
                admin_memberships = db.query(models.OrganizationMembership).filter(
                    models.OrganizationMembership.organization_id == organization_id,
                    models.OrganizationMembership.role.in_(["ORGANIZATION_ADMIN", "SUPERVISOR", "COMMITTEE"]),
                    models.OrganizationMembership.status == "ACTIVE"
                ).all()

                for m in admin_memberships:
                    if m.user_id != actor_user_id and m.user:
                        recipients.append(ResolvedRecipient(
                            user_id=m.user.id,
                            email=m.user.email,
                            role=m.role
                        ))

            elif event_type in (
                WorkflowEventType.PROMOTION_REVIEW_STARTED.value,
                WorkflowEventType.PROMOTION_RETURNED_FOR_CHANGES.value,
                WorkflowEventType.PROMOTION_PROCESS_COMPLETED.value
            ):
                # Notify the Applicant
                if app.applicant and app.user_id != actor_user_id:
                    recipients.append(ResolvedRecipient(
                        user_id=app.applicant.id,
                        email=app.applicant.email,
                        role="APPLICANT"
                    ))

        # -------------------------------------------------------------
        # 2. PEER REVIEW EVENTS
        # -------------------------------------------------------------
        elif aggregate_type == AggregateType.PEER_REVIEW_CASE.value:
            case = db.query(models.PeerReviewCase).filter(
                models.PeerReviewCase.id == aggregate_id,
                models.PeerReviewCase.organization_id == organization_id
            ).first()

            if not case:
                logger.warning(f"RecipientResolver: PeerReviewCase {aggregate_id} not found in org {organization_id}")
                return []

            if event_type == WorkflowEventType.REVIEWER_INVITED.value:
                assignment_id = payload_meta.get("assignment_id")
                if assignment_id:
                    asg = db.query(models.ReviewerAssignment).filter(
                        models.ReviewerAssignment.id == assignment_id,
                        models.ReviewerAssignment.case_id == case.id
                    ).first()
                    if asg and asg.reviewer_user_id:
                        reviewer_user = db.query(models.User).filter(models.User.id == asg.reviewer_user_id).first()
                        if reviewer_user and reviewer_user.id != actor_user_id:
                            recipients.append(ResolvedRecipient(
                                user_id=reviewer_user.id,
                                email=reviewer_user.email,
                                role="REVIEWER"
                            ))

            elif event_type in (
                WorkflowEventType.REVIEWER_ACCEPTED.value,
                WorkflowEventType.REVIEWER_DECLINED.value,
                WorkflowEventType.REVIEW_SUBMITTED.value
            ):
                # Notify the Case Owner
                if case.owner and case.owner_user_id != actor_user_id:
                    recipients.append(ResolvedRecipient(
                        user_id=case.owner.id,
                        email=case.owner.email,
                        role="CASE_OWNER"
                    ))
                # Also notify organizational editorial admins
                admin_memberships = db.query(models.OrganizationMembership).filter(
                    models.OrganizationMembership.organization_id == organization_id,
                    models.OrganizationMembership.role.in_(["ORGANIZATION_ADMIN", "SUPERVISOR"]),
                    models.OrganizationMembership.status == "ACTIVE"
                ).all()
                for m in admin_memberships:
                    if m.user_id != actor_user_id and m.user:
                        recipients.append(ResolvedRecipient(
                            user_id=m.user.id,
                            email=m.user.email,
                            role=m.role
                        ))

            elif event_type == WorkflowEventType.REVISION_REQUESTED.value:
                # Notify the manuscript author / owner
                if case.owner and case.owner_user_id != actor_user_id:
                    recipients.append(ResolvedRecipient(
                        user_id=case.owner.id,
                        email=case.owner.email,
                        role="AUTHOR"
                    ))

            elif event_type == WorkflowEventType.MANUSCRIPT_REVISION_UPLOADED.value:
                # Notify the Editor / Admins
                admin_memberships = db.query(models.OrganizationMembership).filter(
                    models.OrganizationMembership.organization_id == organization_id,
                    models.OrganizationMembership.role.in_(["ORGANIZATION_ADMIN", "SUPERVISOR"]),
                    models.OrganizationMembership.status == "ACTIVE"
                ).all()
                for m in admin_memberships:
                    if m.user_id != actor_user_id and m.user:
                        recipients.append(ResolvedRecipient(
                            user_id=m.user.id,
                            email=m.user.email,
                            role=m.role
                        ))

            elif event_type == WorkflowEventType.FINAL_REVIEW_DECISION_RECORDED.value:
                # Notify Author of final decision
                if case.owner and case.owner_user_id != actor_user_id:
                    recipients.append(ResolvedRecipient(
                        user_id=case.owner.id,
                        email=case.owner.email,
                        role="AUTHOR"
                    ))

        # Thesis recipients are resolved from the thesis and active supervision
        # relationships. Examiner email delivery remains tied to the separately
        # scoped magic-link invitation and never receives confidential payloads.
        elif aggregate_type == AggregateType.THESIS.value:
            thesis = db.query(models.ThesisRecord).filter(models.ThesisRecord.id == aggregate_id, models.ThesisRecord.organization_id == organization_id).first()
            if not thesis: return []
            ids = {thesis.student_user_id}
            ids.update(a.user_id for a in db.query(models.ThesisSupervisionAssignment).filter(models.ThesisSupervisionAssignment.thesis_id == thesis.id, models.ThesisSupervisionAssignment.status == "ACTIVE").all())
            for user in db.query(models.User).filter(models.User.id.in_(ids)).all():
                if user.id != actor_user_id: recipients.append(ResolvedRecipient(user.id, user.email, "THESIS_PARTICIPANT"))

        # -------------------------------------------------------------
        # 3. RESEARCH WORKFLOW / PROJECT EVENTS
        # -------------------------------------------------------------
        elif aggregate_type == AggregateType.RESEARCH_PROJECT.value:
            proj = db.query(models.ResearchProject).filter(
                models.ResearchProject.id == aggregate_id,
                models.ResearchProject.organizationId == organization_id
            ).first()

            if not proj:
                logger.warning(f"RecipientResolver: ResearchProject {aggregate_id} not found in org {organization_id}")
                return []

            if event_type == WorkflowEventType.PROJECT_COMMENT_ADDED.value:
                # Notify Project Owner if someone else commented
                if proj.userId and proj.userId != actor_user_id:
                    owner_user = db.query(models.User).filter(models.User.id == proj.userId).first()
                    if owner_user:
                        recipients.append(ResolvedRecipient(
                            user_id=owner_user.id,
                            email=owner_user.email,
                            role="PROJECT_OWNER"
                        ))

        # -------------------------------------------------------------
        # 4. CROSS-DOMAIN LIFECYCLE EVENTS
        # -------------------------------------------------------------
        elif aggregate_type in {AggregateType.ACADEMIC_HANDOFF.value, AggregateType.RESEARCH_DATASET.value}:
            project = None
            if aggregate_type == AggregateType.ACADEMIC_HANDOFF.value:
                handoff = db.query(models.AcademicHandoff).filter(
                    models.AcademicHandoff.id == aggregate_id,
                    models.AcademicHandoff.organization_id == organization_id,
                ).first()
                if handoff:
                    project = db.query(models.ResearchProject).filter(
                        models.ResearchProject.id == handoff.project_id,
                        models.ResearchProject.organizationId == organization_id,
                    ).first()
            else:
                dataset = db.query(models.ResearchDataset).filter(
                    models.ResearchDataset.id == aggregate_id,
                    models.ResearchDataset.organization_id == organization_id,
                ).first()
                if dataset:
                    project = db.query(models.ResearchProject).filter(
                        models.ResearchProject.id == dataset.project_id,
                        models.ResearchProject.organizationId == organization_id,
                    ).first()
            if project and project.userId and project.userId != actor_user_id:
                owner_user = db.query(models.User).filter(models.User.id == project.userId).first()
                if owner_user:
                    recipients.append(ResolvedRecipient(
                        user_id=owner_user.id,
                        email=owner_user.email,
                        role="PROJECT_OWNER",
                    ))

        # Deduplicate recipients by user_id
        seen_user_ids = set()
        unique_recipients: List[ResolvedRecipient] = []
        for r in recipients:
            if r.user_id not in seen_user_ids:
                seen_user_ids.add(r.user_id)
                unique_recipients.append(r)

        return unique_recipients
