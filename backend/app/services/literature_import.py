"""Bibliographic import from Crossref and PubMed.

Imported rows are references only: sampleSize=1 and identical CI bounds so they
are excluded from inverse-variance meta-analysis until the researcher enters
effect sizes.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from ..config import settings

CROSSREF_URL = "https://api.crossref.org/works"
PUBMED_ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
MAX_RESULTS = 8
REQUEST_TIMEOUT = 12.0


class LiteratureImportError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


@dataclass
class BibliographicRecord:
    author: str
    year: int
    doi: str | None
    notes: str
    source: str


def _user_agent() -> str:
    app_url = (settings.APP_URL or "https://research.ehaastore.com").rstrip("/")
    return f"Baseerah-ResearchBlueprint/1.0 ({app_url}; mailto:research@ehaastore.com)"


def fetch_json(url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    headers = {"User-Agent": _user_agent(), "Accept": "application/json"}
    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            response = client.get(url, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        raise LiteratureImportError("External literature source is unavailable.") from exc
    if not isinstance(payload, dict):
        raise LiteratureImportError("External literature source returned an unexpected payload.")
    return payload


def _join_authors(authors: list[Any], family_key: str = "family", given_key: str = "given") -> str:
    names: list[str] = []
    for author in authors[:4]:
        if not isinstance(author, dict):
            continue
        family = str(author.get(family_key) or "").strip()
        given = str(author.get(given_key) or "").strip()
        label = " ".join(part for part in (family, given) if part).strip() or str(author.get("name") or "").strip()
        if label:
            names.append(label)
    if not names:
        return "Unknown"
    suffix = " et al." if len(authors) > 4 else ""
    return ", ".join(names) + suffix


def _year_from_parts(item: dict[str, Any]) -> int:
    for key in ("published-print", "published-online", "published", "issued"):
        parts = ((item.get(key) or {}) if isinstance(item.get(key), dict) else {}).get("date-parts")
        if isinstance(parts, list) and parts and isinstance(parts[0], list) and parts[0]:
            try:
                year = int(parts[0][0])
                if 1400 <= year <= 2100:
                    return year
            except (TypeError, ValueError):
                continue
    return 0


def search_crossref(query: str) -> list[BibliographicRecord]:
    payload = fetch_json(CROSSREF_URL, {"query.bibliographic": query, "rows": MAX_RESULTS})
    items = ((payload.get("message") or {}) if isinstance(payload.get("message"), dict) else {}).get("items") or []
    records: list[BibliographicRecord] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        titles = item.get("title") or []
        title = titles[0].strip() if isinstance(titles, list) and titles and isinstance(titles[0], str) else ""
        doi = str(item.get("DOI") or "").strip() or None
        if not title and not doi:
            continue
        author = _join_authors(item.get("author") or [])
        year = _year_from_parts(item)
        notes = title or doi or query
        if doi:
            notes = f"{notes} | DOI {doi}"
        records.append(BibliographicRecord(author=author, year=year or 0, doi=doi, notes=notes[:1000], source="crossref"))
    return records


def _pubmed_year(doc: dict[str, Any]) -> int:
    pubdate = str(doc.get("pubdate") or doc.get("sortpubdate") or "").strip()
    if pubdate[:4].isdigit():
        year = int(pubdate[:4])
        if 1400 <= year <= 2100:
            return year
    return 0


def _pubmed_doi(doc: dict[str, Any]) -> str | None:
    for article_id in doc.get("articleids") or []:
        if isinstance(article_id, dict) and str(article_id.get("idtype") or "").lower() == "doi":
            value = str(article_id.get("value") or "").strip()
            if value:
                return value
    return None


def search_pubmed(query: str) -> list[BibliographicRecord]:
    search = fetch_json(PUBMED_ESEARCH_URL, {
        "db": "pubmed",
        "term": query,
        "retmax": MAX_RESULTS,
        "retmode": "json",
    })
    ids = ((search.get("esearchresult") or {}) if isinstance(search.get("esearchresult"), dict) else {}).get("idlist") or []
    id_list = [str(item) for item in ids if item]
    if not id_list:
        return []
    summary = fetch_json(PUBMED_ESUMMARY_URL, {
        "db": "pubmed",
        "id": ",".join(id_list),
        "retmode": "json",
    })
    result = summary.get("result") if isinstance(summary.get("result"), dict) else {}
    records: list[BibliographicRecord] = []
    for pmid in id_list:
        doc = result.get(pmid)
        if not isinstance(doc, dict):
            continue
        title = str(doc.get("title") or "").strip()
        doi = _pubmed_doi(doc)
        if not title and not doi and not pmid:
            continue
        authors = doc.get("authors") or []
        author = _join_authors(authors, family_key="name", given_key="") if authors else str(doc.get("lastauthor") or "Unknown")
        notes = title or f"PMID {pmid}"
        notes = f"{notes} | PMID {pmid}"
        if doi:
            notes = f"{notes} | DOI {doi}"
        records.append(BibliographicRecord(
            author=author or "Unknown",
            year=_pubmed_year(doc),
            doi=doi,
            notes=notes[:1000],
            source="pubmed",
        ))
    return records


def search_records(query: str, source: str) -> list[BibliographicRecord]:
    cleaned = (query or "").strip()
    if len(cleaned) < 3:
        raise LiteratureImportError("Query must be at least 3 characters.", status_code=422)
    if source == "crossref":
        return search_crossref(cleaned)
    if source == "pubmed":
        return search_pubmed(cleaned)
    raise LiteratureImportError("Unsupported literature source.", status_code=422)
