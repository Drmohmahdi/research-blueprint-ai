from fastapi import APIRouter, Depends, Request

from ..schemas import TitleAnalysisRequest, TitleAnalysisResponse
from ..services.ai_service import analyze_research_title_ai
from ..services.tenant_context import get_tenant_context, TenantContext
from ..rate_limit import limiter

router = APIRouter(prefix="/analyzer", tags=["analyzer"])


@router.post("/analyze-title", response_model=TitleAnalysisResponse)
@limiter.limit("30/minute")
def analyze_title_endpoint(
    request: Request,
    body: TitleAnalysisRequest,
    context: TenantContext = Depends(get_tenant_context),
):
    return analyze_research_title_ai(body.title)
