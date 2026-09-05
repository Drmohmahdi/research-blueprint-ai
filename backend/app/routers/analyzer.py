from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas import TitleAnalysisRequest, TitleAnalysisResponse
from ..services.ai_service import analyze_research_title_ai
from ..services.tenant_context import get_tenant_context, TenantContext, verify_usage_limit
from ..rate_limit import limiter

router = APIRouter(prefix="/analyzer", tags=["analyzer"])


@router.post("/analyze-title", response_model=TitleAnalysisResponse)
@limiter.limit("30/minute")
def analyze_title_endpoint(
    request: Request,
    body: TitleAnalysisRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
    _usage_gate: TenantContext = Depends(verify_usage_limit("AI_TOKENS", "ai_tokens_limit")),
):
    return analyze_research_title_ai(body.title, db=db, org_id=context.organization.id, user_id=context.user.id)
