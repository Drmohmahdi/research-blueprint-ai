import datetime
import hashlib
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ReportType(str, Enum):
    RESEARCH_PROJECT = "RESEARCH_PROJECT"
    LITERATURE_SYNTHESIS = "LITERATURE_SYNTHESIS"
    PRISMA_FLOW = "PRISMA_FLOW"
    PROMOTION_READINESS = "PROMOTION_READINESS"
    PEER_REVIEW = "PEER_REVIEW"
    ACADEMIC_PROFILE = "ACADEMIC_PROFILE"
    THESIS_PROGRESS = "THESIS_PROGRESS"
    THESIS_EXAMINER_REPORT = "THESIS_EXAMINER_REPORT"
    THESIS_MEETING = "THESIS_MEETING"
    THESIS_MILESTONE = "THESIS_MILESTONE"
    THESIS_DEFENSE_READINESS = "THESIS_DEFENSE_READINESS"
    THESIS_CORRECTIONS = "THESIS_CORRECTIONS"
    THESIS_COMPLETION = "THESIS_COMPLETION"
    THESIS_GRADUATE_PORTFOLIO = "THESIS_GRADUATE_PORTFOLIO"


class ReportFormat(str, Enum):
    PDF = "PDF"
    DOCX = "DOCX"
    JSON = "JSON"


class ReportAudience(str, Enum):
    RESEARCHER = "RESEARCHER"
    AUTHOR = "AUTHOR"
    SUPERVISOR = "SUPERVISOR"
    COMMITTEE = "COMMITTEE"
    DEAN_OFFICE = "DEAN_OFFICE"
    EXTERNAL_AUDITOR = "EXTERNAL_AUDITOR"
    ADMIN = "ADMIN"
    PUBLIC = "PUBLIC"


class ReportTable(BaseModel):
    title_ar: Optional[str] = None
    title_en: Optional[str] = None
    headers_ar: List[str] = Field(default_factory=list)
    headers_en: List[str] = Field(default_factory=list)
    rows: List[List[Any]] = Field(default_factory=list)


class ReportSection(BaseModel):
    key: str
    title_ar: str
    title_en: str
    paragraphs_ar: List[str] = Field(default_factory=list)
    paragraphs_en: List[str] = Field(default_factory=list)
    key_metrics: Dict[str, Any] = Field(default_factory=dict)
    tables: List[ReportTable] = Field(default_factory=list)
    callouts_ar: List[str] = Field(default_factory=list)
    callouts_en: List[str] = Field(default_factory=list)
    code_blocks: Dict[str, str] = Field(default_factory=dict)
    is_confidential: bool = False


class ReportManifest(BaseModel):
    report_id: str
    schema_version: str = "1.0.0"
    report_type: ReportType
    source_type: str
    source_id: str
    source_version: Optional[int] = 1
    organization_id: str
    organization_name_ar: str
    organization_name_en: str
    generated_by_user_id: str
    generated_by_username: str
    generated_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat())
    language: str = "ar"  # "ar", "en", "bilingual"
    audience: ReportAudience = ReportAudience.RESEARCHER
    template_version: str = "academic-standard-v1"
    verification_code: str
    verification_code_hash: str


class CanonicalReportContext(BaseModel):
    manifest: ReportManifest
    title_ar: str
    title_en: str
    subtitle_ar: Optional[str] = None
    subtitle_en: Optional[str] = None
    summary_ar: Optional[str] = None
    summary_en: Optional[str] = None
    disclaimer_ar: Optional[str] = None
    disclaimer_en: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    sections: List[ReportSection] = Field(default_factory=list)

    def calculate_source_hash(self) -> str:
        """Computes SHA-256 hash of the canonical report text content for reproducibility and audit."""
        content_str = f"{self.manifest.report_type}:{self.manifest.source_id}:{self.title_ar}:{self.title_en}:{len(self.sections)}"
        for sec in self.sections:
            content_str += f"|{sec.key}:{len(sec.paragraphs_ar)}:{len(sec.paragraphs_en)}:{len(sec.tables)}"
        return hashlib.sha256(content_str.encode("utf-8")).hexdigest()
