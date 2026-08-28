import os
import sys
from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..schemas import TitleAnalysisRequest, TitleAnalysisResponse
from ..services.ai_service import analyze_research_title_ai
from ..services.tenant_context import get_tenant_context, TenantContext

router = APIRouter(prefix="/analyzer", tags=["analyzer"])

limiter = Limiter(key_func=get_remote_address, enabled=not ("pytest" in sys.modules or os.getenv("TESTING") == "True"))


@router.post("/analyze-title", response_model=TitleAnalysisResponse)
@limiter.limit("30/minute")
def analyze_title_endpoint(
    request: Request,
    body: TitleAnalysisRequest,
    context: TenantContext = Depends(get_tenant_context),
):
    return analyze_research_title_ai(body.title)
