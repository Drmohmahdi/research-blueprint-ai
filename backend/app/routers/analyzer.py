from fastapi import APIRouter
from ..schemas import TitleAnalysisRequest, TitleAnalysisResponse
from ..services.ai_service import analyze_research_title_ai

router = APIRouter(prefix="/analyzer", tags=["analyzer"])

@router.post("/analyze-title", response_model=TitleAnalysisResponse)
def analyze_title_endpoint(request: TitleAnalysisRequest):
    return analyze_research_title_ai(request.title)
