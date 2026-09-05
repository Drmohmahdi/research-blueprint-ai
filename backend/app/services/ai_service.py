import logging
import re
import json
from typing import Optional
from google import genai
from sqlalchemy.orm import Session
from ..config import settings
from ..observability import log_event
from ..schemas import TitleAnalysisResponse

def run_local_fallback_analyzer(title: str) -> TitleAnalysisResponse:
    t = title.strip()
    
    independent_variables = []
    dependent_variables = []
    population = ""
    suggested_methodology = "descriptive"
    confidence = 0.7
    ambiguities = []
    follow_up_questions = []

    is_arabic = bool(re.search(r"[\u0600-\u06FF]", t))

    if is_arabic:
        if any(w in t for w in ["أثر", "فاعلية", "تأثير", "برنامج"]):
            suggested_methodology = "quasi_experimental_pre_post"
            confidence = 0.85
            match = re.search(r"(?:أثر|فاعلية|تأثير)\s+(.*?)\s+(?:في|على|في تحسين|في تنمية)\s+(.*?)(?:\s+(?:لدى|عند|على طلاب)\s+(.*))?$", t)
            if match:
                independent_variables = [match.group(1).strip()]
                dv_part = match.group(2).strip()
                
                # Check for population inside DV
                for marker in [" لدى", " عند"]:
                    if marker in dv_part:
                        parts = dv_part.split(marker, 1)
                        dv_part = parts[0].strip()
                        population = parts[1].strip()
                
                if not population and match.group(3):
                    population = match.group(3).strip()
                dependent_variables = [dv_part]
        elif any(w in t for w in ["علاقة", "الارتباطية", "ارتباط"]):
            suggested_methodology = "correlational"
            confidence = 0.9
            match = re.search(r"علاقة\s+(.*?)\s+بـ\s+(.*?)(?:\s+(?:لدى|عند)\s+(.*))?$", t) or re.search(r"العلاقة\s+بين\s+(.*?)\s+و\s+(.*?)(?:\s+(?:لدى|عند)\s+(.*))?$", t)
            if match:
                independent_variables = [match.group(1).strip()]
                dependent_variables = [match.group(2).strip()]
                if match.group(3):
                    population = match.group(3).strip()
        elif any(w in t for w in ["تنبؤ", "التنبؤية", "إمكانية التنبؤ"]):
            suggested_methodology = "predictive"
            confidence = 0.88
        elif any(w in t for w in ["واقع", "تقويم", "معوقات", "اتجاهات", "مستوى"]):
            suggested_methodology = "descriptive"
            confidence = 0.8
            match = re.search(r"(?:لدى|عند|من وجهة نظر)\s+(.*)$", t)
            if match:
                population = match.group(1).strip()
    else:
        lower_t = t.lower()
        if any(w in lower_t for w in ["effect of", "impact of", "effectiveness of"]):
            suggested_methodology = "quasi_experimental_pre_post"
            confidence = 0.88
            match = re.search(r"(?:Effect|Impact|Effectiveness)\s+of\s+(.*?)\s+on\s+(.*?)\s+among\s+(.*)", t, re.IGNORECASE) or \
                    re.search(r"(?:Effect|Impact|Effectiveness)\s+of\s+(.*?)\s+on\s+(.*)", t, re.IGNORECASE)
            if match:
                independent_variables = [match.group(1).strip()]
                if len(match.groups()) >= 3 and match.group(3):
                    dependent_variables = [match.group(2).strip()]
                    population = match.group(3).strip()
                else:
                    dv_part = match.group(2).strip()
                    if " among " in dv_part.lower():
                        parts = re.split(r"\s+among\s+", dv_part, flags=re.IGNORECASE)
                        dv_part = parts[0].strip()
                        population = parts[1].strip()
                    dependent_variables = [dv_part]
        elif "relationship between" in lower_t or "correlation between" in lower_t:
            suggested_methodology = "correlational"
            confidence = 0.9
            match = re.search(r"(?:Relationship|Correlation)\s+between\s+(.*?)\s+and\s+(.*?)\s+among\s+(.*)", t, re.IGNORECASE) or \
                    re.search(r"(?:Relationship|Correlation)\s+between\s+(.*?)\s+and\s+(.*)", t, re.IGNORECASE)
            if match:
                independent_variables = [match.group(1).strip()]
                if len(match.groups()) >= 3 and match.group(3):
                    dependent_variables = [match.group(2).strip()]
                    population = match.group(3).strip()
                else:
                    dv_part = match.group(2).strip()
                    if " among " in dv_part.lower():
                        parts = re.split(r"\s+among\s+", dv_part, flags=re.IGNORECASE)
                        dv_part = parts[0].strip()
                        population = parts[1].strip()
                    dependent_variables = [dv_part]

    if not independent_variables:
        independent_variables = ["المتغير المستقل المقترح" if is_arabic else "Proposed Independent Variable"]
    if not dependent_variables:
        dependent_variables = ["المتغير التابع المقترح" if is_arabic else "Proposed Dependent Variable"]
    if not population:
        population = "عينة الدراسة (مثال: الطلاب)" if is_arabic else "Study Population (e.g. Students)"

    if len(t) < 15:
        ambiguities.append("عنوان البحث قصير جداً وقد يفتقد الدقة." if is_arabic else "The title is very short and might lack specificity.")

    if is_arabic and not any(w in t for w in ["في", "على", "لدى"]):
        ambiguities.append("يفتقر العنوان إلى روابط واضحة توضح العلاقة أو مجتمع الدراسة.")

    if suggested_methodology in ["quasi_experimental_pre_post", "experimental_rct"]:
        follow_up_questions.append("هل توجد مجموعة ضابطة لمقارنتها بالمجموعة التجريبية؟" if is_arabic else "Is there a control group to compare with the treatment group?")
        follow_up_questions.append("ما هي مدة تطبيق التدخل أو البرنامج المقترح؟" if is_arabic else "What is the duration of the proposed intervention or program?")

    return TitleAnalysisResponse(
        independentVariables=independent_variables,
        dependentVariables=dependent_variables,
        mediators=[],
        moderators=[],
        controls=[],
        population=population,
        context="البيئة التعليمية / الميدانية" if is_arabic else "Educational / Field Context",
        suggestedMethodology=suggested_methodology,
        confidence=confidence,
        ambiguities=ambiguities,
        followUpQuestions=follow_up_questions,
        isFallback=True
    )

def analyze_research_title_ai(
    title: str,
    db: Optional[Session] = None,
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> TitleAnalysisResponse:
    # 1. Prompt Injection Sanitization
    cleaned_title = title.strip()
    injection_keywords = ["ignore", "instruction", "system prompt", "translate", "bypass", "delete", "drop", "select *", "you are now"]
    for keyword in injection_keywords:
        if keyword in cleaned_title.lower():
            # Strip injection attempts to prevent hijacking
            cleaned_title = cleaned_title.replace(keyword, "")

    if not settings.GEMINI_API_KEY:
        return run_local_fallback_analyzer(cleaned_title)
        
    # 2. Retry Logic (Up to 3 times)
    attempts = 3
    for attempt in range(attempts):
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            
            prompt = f"""
            You are a senior academic methodology advisor and statistician.
            Analyze the following research title and extract its structural components:
            Title: "{cleaned_title}"
            
            Return the result strictly as a valid JSON object matching this schema:
            {{
              "independentVariables": ["name"],
              "dependentVariables": ["name"],
              "mediators": ["name"],
              "moderators": ["name"],
              "controls": ["name"],
              "population": "target population",
              "context": "environment/context",
              "suggestedMethodology": "experimental_rct" | "quasi_experimental_pre_post" | "descriptive" | "correlational" | "predictive",
              "confidence": 0.0 to 1.0,
              "ambiguities": ["any wording ambiguities"],
              "followUpQuestions": ["clarifying questions"]
            }}
            
            Reply ONLY with the raw JSON. Do not include markdown wraps or ticks.
            """
            
            # Using generate_content with new SDK
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt
            )
            text = response.text.strip()

            if db is not None and org_id is not None:
                usage_md = getattr(response, "usage_metadata", None)
                total_tokens = int(getattr(usage_md, "total_token_count", 0) or 0) if usage_md else 0
                if total_tokens > 0:
                    from .tenant_context import record_usage_event
                    record_usage_event(db, org_id, user_id, "AI_TOKENS", quantity=float(total_tokens))

            # Clean any accidental markdown wrap
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\n", "", text)
                text = re.sub(r"\n```$", "", text)

            data = json.loads(text.strip())

            # Validate required fields
            return TitleAnalysisResponse(
                independentVariables=data.get("independentVariables", []),
                dependentVariables=data.get("dependentVariables", []),
                mediators=data.get("mediators", []),
                moderators=data.get("moderators", []),
                controls=data.get("controls", []),
                population=data.get("population", ""),
                context=data.get("context", ""),
                suggestedMethodology=data.get("suggestedMethodology", "descriptive"),
                confidence=data.get("confidence", 0.8),
                ambiguities=data.get("ambiguities", []),
                followUpQuestions=data.get("followUpQuestions", []),
                isFallback=False
            )
        except Exception as e:
            log_event(logging.WARNING, "ai.gemini.attempt_failed", attempt=attempt + 1, attempts=attempts, exception_type=type(e).__name__)
            if attempt == attempts - 1:
                log_event(logging.WARNING, "ai.gemini.all_attempts_failed_falling_back_to_local_rules")
                return run_local_fallback_analyzer(cleaned_title)
    
    return run_local_fallback_analyzer(cleaned_title)
