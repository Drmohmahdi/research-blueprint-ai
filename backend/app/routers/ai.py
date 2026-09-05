"""
Phase 10 — Governed Academic AI API.

Server-side controlled AI assistance. Clients may only send use_case + minimal
task inputs; they can NEVER supply system_prompt, provider, model, or provider
parameters. Entitlement (AI_ASSISTANCE) is enforced on every call.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..services.tenant_context import get_tenant_context, TenantContext
from ..services.ai import GovernedAIService, AIServiceError, AuthorizationError, ContextBuildError
from ..services.billing import EntitlementService, FeatureKey
from ..rate_limit import limiter

router = APIRouter(prefix="/ai", tags=["Governed Academic AI"])

MAX_QUESTION_CHARS = 20000


class AIAssistRequest(BaseModel):
    use_case: str = Field(..., description="Registered AI use case (enum)")
    question: Optional[str] = Field(None, max_length=MAX_QUESTION_CHARS)
    text: Optional[str] = Field(None, max_length=MAX_QUESTION_CHARS)
    project_id: Optional[str] = None
    study_ids: Optional[List[str]] = Field(default=None, max_length=20)
    case_id: Optional[str] = None
    application_id: Optional[str] = None
    idempotency_key: Optional[str] = Field(default=None, max_length=128)


class AIUsageRow(BaseModel):
    id: str
    use_case: str
    provider: str
    model: Optional[str] = None
    prompt_version: Optional[int] = None
    input_token_count: Optional[int] = None
    output_token_count: Optional[int] = None
    estimated_tokens: Optional[int] = None
    status: str
    latency_ms: Optional[int] = None
    error_code: Optional[str] = None
    retrieval_count: Optional[int] = None
    idempotency_key: Optional[str] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class AIUsageResponse(BaseModel):
    total_runs: int
    recent: List[AIUsageRow]


@router.post("/assist", response_model=schemas.AIResponse, summary="Run a governed AI assistance use case")
@limiter.limit("30/minute")
def ai_assist(
    request: Request,
    req: AIAssistRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    try:
        result = GovernedAIService.assist(
            db=db,
            ctx=context,
            use_case=req.use_case,
            payload=req.model_dump(),
            idempotency_key=req.idempotency_key,
        )
        return schemas.AIResponse(
            use_case=result["use_case"],
            prompt_version=result["prompt_version"],
            provider=result["provider"],
            model=result["model"],
            text=result["text"],
            structured=result["structured"],
            sources=result["sources"],
            grounded=result["grounded"],
            requires_verification=result["requires_verification"],
            human_authority=result["human_authority"],
            ai_generated=result["ai_generated"],
            usage=result["usage"],
        )
    except AIServiceError as exc:
        raise HTTPException(status_code=exc.http_status, detail=exc.message)
    except AuthorizationError as exc:
        raise HTTPException(status_code=403, detail="AI context authorization failed")
    except ContextBuildError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/use-cases", response_model=List[str], summary="List registered AI use cases")
def ai_use_cases(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    # Entitlement gate for listing too (no data leak about AI features without plan)
    EntitlementService.require_feature(db, context.organization.id, FeatureKey.AI_ASSISTANCE.value)
    return GovernedAIService.list_use_cases()


@router.get("/status", summary="AI provider status (non-sensitive)")
def ai_status(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    EntitlementService.require_feature(db, context.organization.id, FeatureKey.AI_ASSISTANCE.value)
    return GovernedAIService.status()


@router.get("/usage", response_model=AIUsageResponse, summary="AI usage records for current organization")
def ai_usage(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    EntitlementService.require_feature(db, context.organization.id, FeatureKey.AI_ASSISTANCE.value)
    runs = (
        db.query(models.AIRun)
        .filter(models.AIRun.organization_id == context.organization.id)
        .order_by(models.AIRun.created_at.desc())
        .limit(limit)
        .all()
    )
    return AIUsageResponse(
        total_runs=db.query(models.AIRun).filter(
            models.AIRun.organization_id == context.organization.id
        ).count(),
        recent=[AIUsageRow.model_validate(r) for r in runs],
    )
