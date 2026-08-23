import enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class WorkflowEventType(str, enum.Enum):
    # Promotion Engine Events
    PROMOTION_APPLICATION_SUBMITTED = "PROMOTION_APPLICATION_SUBMITTED"
    PROMOTION_REVIEW_STARTED = "PROMOTION_REVIEW_STARTED"
    PROMOTION_RETURNED_FOR_CHANGES = "PROMOTION_RETURNED_FOR_CHANGES"
    PROMOTION_PROCESS_COMPLETED = "PROMOTION_PROCESS_COMPLETED"

    # Peer Review Events
    REVIEWER_INVITED = "REVIEWER_INVITED"
    REVIEWER_ACCEPTED = "REVIEWER_ACCEPTED"
    REVIEWER_DECLINED = "REVIEWER_DECLINED"
    REVIEW_SUBMITTED = "REVIEW_SUBMITTED"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    MANUSCRIPT_REVISION_UPLOADED = "MANUSCRIPT_REVISION_UPLOADED"
    FINAL_REVIEW_DECISION_RECORDED = "FINAL_REVIEW_DECISION_RECORDED"

    # Research Workflow & Project Events
    PROJECT_COMMENT_ADDED = "PROJECT_COMMENT_ADDED"
    PROJECT_STATUS_CHANGED = "PROJECT_STATUS_CHANGED"


class AggregateType(str, enum.Enum):
    PROMOTION_APPLICATION = "PROMOTION_APPLICATION"
    PEER_REVIEW_CASE = "PEER_REVIEW_CASE"
    RESEARCH_PROJECT = "RESEARCH_PROJECT"


class NotificationCategory(str, enum.Enum):
    PROMOTION = "PROMOTION"
    PEER_REVIEW = "PEER_REVIEW"
    RESEARCH_WORKFLOW = "RESEARCH_WORKFLOW"
    SYSTEM = "SYSTEM"


class NotificationChannel(str, enum.Enum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"


class EventStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"


class DeliveryStatus(str, enum.Enum):
    DELIVERED = "DELIVERED"
    NOT_CONFIGURED = "NOT_CONFIGURED"
    FAILED = "FAILED"
    SKIPPED_PREFERENCE = "SKIPPED_PREFERENCE"


class EventPayload(BaseModel):
    title_ar: str
    title_en: str
    message_ar: str
    message_en: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
