"""
Phase 09 — Search Text Normalization & Identifier Canonicalization.

Provides consistent, documented normalization used by the Unified Search layer:

Arabic normalization (conservative, search-only):
    - remove diacritics (harakat) and tatweel
    - أ / إ / آ  ->  ا
    - ى         ->  ي
    - Arabic punctuation -> whitespace
    - collapse whitespace, lowercase
Intentionally NOT applied: ة -> ه mapping, Arabic digit conversion (to avoid
changing academic meaning). Identifiers (DOI/ORCID/ISSN/ISBN/URLs) are handled
by dedicated canonicalizers that never apply Arabic text normalization.
"""
import re
import unicodedata

# Harakat / diacritics ranges (U+064B..U+0652) plus U+0670 superscript alef
_DIACRITICS_RE = re.compile("[\u064B-\u0652\u0670]")
_TATWEEL_RE = re.compile("\u0640")
_AR_PUNCT_RE = re.compile("[\u0600-\u060C\u061B\u061C\u061D\u061F\u066A-\u066D\u06D4]")
_WS_RE = re.compile(r"\s+")


def strip_diacritics(text: str) -> str:
    return _DIACRITICS_RE.sub("", text)


def normalize_arabic(text: str) -> str:
    """Conservative Arabic normalization for search purposes only."""
    s = unicodedata.normalize("NFKC", text)
    s = _DIACRITICS_RE.sub("", s)
    s = _TATWEEL_RE.sub(" ", s)
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    s = s.replace("ى", "ي")
    s = _AR_PUNCT_RE.sub(" ", s)
    return s


def normalize_search_text(text) -> str:
    """Normalize arbitrary search text (Arabic + English aware)."""
    if text is None:
        return ""
    s = unicodedata.normalize("NFKC", str(text))
    s = normalize_arabic(s)
    s = s.lower()
    s = _WS_RE.sub(" ", s).strip()
    return s


def escape_like(value: str, escape_char: str = "\\") -> str:
    """Escape LIKE wildcards so user input is matched literally."""
    return (
        str(value)
        .replace(escape_char, escape_char + escape_char)
        .replace("%", escape_char + "%")
        .replace("_", escape_char + "_")
    )


# ── Identifier Canonicalization (never Arabic-normalized) ─────────────────────

def canonical_doi(value) -> str:
    """Canonical DOI form: '10.1234/abcd' from any common representation."""
    if not value:
        return ""
    s = str(value).strip()
    s = s.lower()
    s = re.sub(r"^https?://(dx\.)?doi\.org/", "", s)
    s = re.sub(r"^doi:\s*", "", s)
    s = s.strip().strip("/")
    return s


def canonical_orcid(value) -> str:
    """Canonical ORCID form: '0000-0002-1825-0097' (uppercase, dashes kept)."""
    if not value:
        return ""
    s = str(value).strip().upper()
    s = re.sub(r"^HTTPS?://ORCID\.ORG/", "", s)
    s = s.strip().strip("/")
    return s
