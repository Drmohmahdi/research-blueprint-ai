from typing import Tuple
from sqlalchemy.orm import Session
from ... import models
from .events import NotificationCategory, WorkflowEventType, AggregateType


class NotificationPolicy:
    @staticmethod
    def get_category_for_event(event_type: str, aggregate_type: str) -> str:
        if aggregate_type == AggregateType.PROMOTION_APPLICATION.value or "PROMOTION" in event_type:
            return NotificationCategory.PROMOTION.value
        elif aggregate_type == AggregateType.PEER_REVIEW_CASE.value or "REVIEW" in event_type:
            return NotificationCategory.PEER_REVIEW.value
        elif aggregate_type in {
            AggregateType.RESEARCH_PROJECT.value,
            AggregateType.ACADEMIC_HANDOFF.value,
            AggregateType.RESEARCH_DATASET.value,
            AggregateType.THESIS.value,
        } or any(token in event_type for token in ("PROJECT", "HANDOFF", "DATASET", "DOWNSTREAM", "THESIS")):
            return NotificationCategory.RESEARCH_WORKFLOW.value
        return NotificationCategory.SYSTEM.value

    @staticmethod
    def is_in_app_mandatory(category: str, event_type: str) -> bool:
        """
        Critical workflow decisions (Promotion submissions/decisions, Peer Review revisions/decisions)
        are workflow-required for in-app delivery so the researcher/reviewer does not miss critical deadlines.
        """
        if event_type in (
            WorkflowEventType.PROMOTION_APPLICATION_SUBMITTED.value,
            WorkflowEventType.PROMOTION_PROCESS_COMPLETED.value,
            WorkflowEventType.PROMOTION_RETURNED_FOR_CHANGES.value,
            WorkflowEventType.REVISION_REQUESTED.value,
            WorkflowEventType.FINAL_REVIEW_DECISION_RECORDED.value
        ):
            return True
        return False

    @staticmethod
    def should_deliver(
        db: Session,
        user_id: str,
        organization_id: str,
        category: str,
        event_type: str
    ) -> Tuple[bool, bool]:
        """
        Returns (deliver_in_app: bool, deliver_email: bool) based on user preferences and mandatory rules.
        """
        pref = db.query(models.NotificationPreference).filter(
            models.NotificationPreference.user_id == user_id,
            models.NotificationPreference.organization_id == organization_id,
            models.NotificationPreference.category == category
        ).first()

        # Defaults if preference row does not exist yet: both enabled
        in_app_pref = pref.in_app_enabled if pref else True
        email_pref = pref.email_enabled if pref else True

        # Check mandatory override for In-App
        if NotificationPolicy.is_in_app_mandatory(category, event_type):
            deliver_in_app = True
        else:
            deliver_in_app = in_app_pref

        deliver_email = email_pref

        return deliver_in_app, deliver_email
