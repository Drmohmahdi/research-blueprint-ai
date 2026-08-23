import json
import hashlib
from typing import Dict, Any
from ..models import CanonicalReportContext


class JsonReportRenderer:
    @staticmethod
    def render(context: CanonicalReportContext) -> tuple[bytes, str]:
        """
        Renders CanonicalReportContext into standardized, structured JSON bytes.
        Implements non-circular hashing:
          1. Computes deterministic contextHash on the canonical payload (excluding docHash).
          2. Emits contextHash into payload.integrity.
          3. Computes documentHash on the final serialized UTF-8 bytes.
        Returns: (json_bytes, document_hash)
        """
        payload: Dict[str, Any] = {
            "schemaVersion": context.manifest.schema_version,
            "reportId": context.manifest.report_id,
            "reportType": context.manifest.report_type.value,
            "manifest": context.manifest.model_dump(),
            "title": {
                "ar": context.title_ar,
                "en": context.title_en
            },
            "subtitle": {
                "ar": context.subtitle_ar,
                "en": context.subtitle_en
            },
            "disclaimer": {
                "ar": context.disclaimer_ar,
                "en": context.disclaimer_en
            },
            "metadata": context.metadata,
            "sections": [
                {
                    "key": sec.key,
                    "title": {"ar": sec.title_ar, "en": sec.title_en},
                    "paragraphs": {"ar": sec.paragraphs_ar, "en": sec.paragraphs_en},
                    "keyMetrics": sec.key_metrics,
                    "callouts": {"ar": sec.callouts_ar, "en": sec.callouts_en},
                    "tables": [
                        {
                            "title": {"ar": t.title_ar, "en": t.title_en},
                            "headers": {"ar": t.headers_ar, "en": t.headers_en},
                            "rows": t.rows
                        }
                        for t in sec.tables
                    ],
                    "codeBlocks": sec.code_blocks,
                    "isConfidential": sec.is_confidential
                }
                for sec in context.sections
            ],
            "provenance": {
                "generatedByUserId": context.manifest.generated_by_user_id,
                "generatedByUsername": context.manifest.generated_by_username,
                "organizationId": context.manifest.organization_id,
                "organizationNameAr": context.manifest.organization_name_ar,
                "organizationNameEn": context.manifest.organization_name_en,
                "generatedAt": context.manifest.generated_at,
                "sourceSnapshotHash": context.calculate_source_hash(),
                "templateVersion": context.manifest.template_version
            },
            "integrity": {
                "verificationCode": context.manifest.verification_code,
                "verificationCodeHash": context.manifest.verification_code_hash
            }
        }

        # 1. Deterministic Canonical Context Hash (source content integrity before rendering)
        canonical_str = json.dumps(payload, ensure_ascii=False, sort_keys=True)
        context_hash = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()
        payload["integrity"]["contextHash"] = context_hash

        # 2. Final Serialized Document Bytes & Document Binary Hash
        final_str = json.dumps(payload, ensure_ascii=False, indent=2)
        raw_bytes = final_str.encode("utf-8")
        doc_hash = hashlib.sha256(raw_bytes).hexdigest()

        return raw_bytes, doc_hash
