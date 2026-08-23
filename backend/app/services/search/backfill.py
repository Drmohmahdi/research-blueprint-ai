"""
Phase 09 — Search-text backfill for existing records during migration.

Recomputes the normalized `search_text` column for all existing rows in the
searchable domain tables so pre-Phase-09 data becomes discoverable immediately
after migration.
"""


def _coerce(value):
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        import json
        try:
            return " ".join(str(v) for v in (value.values() if isinstance(value, dict) else value))
        except Exception:
            return json.dumps(value, ensure_ascii=False)
    return str(value)


def backfill_all_search_text(conn, normalize):
    # Each entry: (table, id_column, [(search_text_column, [field columns])])
    tables = [
        ("research_projects", "id", "search_text",
         ["titleAr", "titleEn", "descriptionAr", "descriptionEn",
          "problemStatementAr", "problemStatementEn", "objectives", "studyDesign"]),
        ("project_literature_studies", "id", "search_text",
         ["author", "source", "doi", "notes", "year"]),
        ("core_scholarly_assets", "id", "search_text",
         ["title_ar", "title_en", "abstract_ar", "abstract_en", "doi",
          "journal_name", "publisher", "primary_discipline", "asset_type"]),
        ("core_unified_academic_profiles", "id", "search_text",
         ["preferred_name_ar", "preferred_name_en", "academic_title",
          "current_rank", "university", "college", "department",
          "general_specialization", "research_interests_json"]),
        ("promotion_applications", "id", "search_text",
         ["target_rank", "current_rank", "status"]),
        ("peer_review_cases", "id", "search_text",
         ["title_ar", "title_en", "abstract_ar", "abstract_en",
          "discipline", "case_type", "status"]),
        ("uploaded_files", "id", "search_text",
         ["filename", "mime_type", "classification"]),
    ]

    for table, id_col, search_col, fields in tables:
        try:
            col_list = ", ".join([id_col] + fields)
            rows = conn.execute(__import__("sqlalchemy").text(f"SELECT {col_list} FROM {table}")).fetchall()
        except Exception:
            continue  # table may not exist in a fresh DB
        for row in rows:
            parts = []
            for idx, field in enumerate(fields):
                val = row[idx + 1]
                text = _coerce(val)
                if text:
                    parts.append(text)
            normalized = normalize(" ".join(parts))
            conn.execute(
                __import__("sqlalchemy").text(
                    f"UPDATE {table} SET {search_col} = :norm WHERE {id_col} = :rid"
                ),
                {"norm": normalized, "rid": row[0]},
            )
