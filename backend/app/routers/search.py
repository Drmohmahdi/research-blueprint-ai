"""
Phase 09 — Unified Search & Academic Data Discovery API.

GET /api/search?q=...&domains=PROJECT,LITERATURE&filters={"status":"ACTIVE"}&sort=relevance&page=1&limit=20

Security model:
  - Authorization is applied BEFORE any result exposure inside each domain provider.
  - Filters/sorts are whitelisted per domain (no raw ORM field injection).
  - Query length, page size, and page count are bounded.
"""
import json
import os
import sys
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from ..db import get_db
from .. import schemas
from ..services.tenant_context import get_tenant_context, TenantContext
from ..services.search.providers import UnifiedSearchService, get_provider
from ..services.search import signals
from ..rate_limit import limiter

signals.register_search_signals()

router = APIRouter(prefix="/search", tags=["Unified Search & Discovery"])

MAX_QUERY_LENGTH = 200
MAX_FILTER_KEYS = 20
MAX_DOMAINS = 10
MAX_LIMIT = 100
DEFAULT_LIMIT = 20
MAX_PAGE = 10000


def _parse_domains(domains: Optional[str]) -> Optional[List[str]]:
    if not domains:
        return None
    parts = [d.strip().upper() for d in domains.split(",") if d.strip()]
    if not parts:
        raise HTTPException(status_code=422, detail="domains parameter is empty")
    for d in parts:
        if d not in schemas.ALLOWED_SEARCH_DOMAINS:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid domain '{d}'. Allowed: {schemas.ALLOWED_SEARCH_DOMAINS}"
            )
    if len(parts) > MAX_DOMAINS:
        raise HTTPException(status_code=422, detail=f"Too many domains (max {MAX_DOMAINS})")
    return parts


def _parse_filters(raw: Optional[str]) -> dict:
    if not raw:
        return {}
    if len(raw) > 2000:
        raise HTTPException(status_code=422, detail="filters parameter too long")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="filters must be a valid JSON object")
    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail="filters must be a JSON object")
    if len(data) > MAX_FILTER_KEYS:
        raise HTTPException(status_code=422, detail=f"Too many filter keys (max {MAX_FILTER_KEYS})")
    return data


def _validate_sort(sort: str) -> str:
    if sort not in schemas.ALLOWED_SEARCH_SORTS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid sort '{sort}'. Allowed: {schemas.ALLOWED_SEARCH_SORTS}"
        )
    return sort


def _validate_filters_whitelist(filters: dict, domains: Optional[List[str]] = None) -> None:
    """Reject unknown filter keys against the whitelist of requested (or all) domains."""
    providers = []
    if domains:
        for d in domains:
            p = get_provider(d)
            if p:
                providers.append(p)
    else:
        from ..services.search.providers import get_all_providers
        providers = get_all_providers()

    allowed = set()
    for p in providers:
        allowed |= p.filters_whitelist()
    unknown = set(filters.keys()) - allowed
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown filter key(s): {sorted(unknown)}. Allowed: {sorted(allowed)}"
        )

    # Validate year range
    yf = filters.get("year_from")
    yt = filters.get("year_to")
    if yf is not None or yt is not None:
        if isinstance(yf, bool) or (yf is not None and not isinstance(yf, int)):
            raise HTTPException(status_code=422, detail="year_from must be an integer")
        if isinstance(yt, bool) or (yt is not None and not isinstance(yt, int)):
            raise HTTPException(status_code=422, detail="year_to must be an integer")
        if yf is not None and yt is not None and yf > yt:
            raise HTTPException(status_code=422, detail="year_from cannot be greater than year_to")
    # Validate boolean filters
    for k in ("doi_present", "assigned_to_me"):
        if k in filters and not isinstance(filters[k], bool):
            raise HTTPException(status_code=422, detail=f"{k} must be a boolean")
    # Validate string filters are non-empty strings
    for k, v in filters.items():
        if k in ("year_from", "year_to", "doi_present", "assigned_to_me"):
            continue
        if not isinstance(v, str) or not v.strip():
            raise HTTPException(status_code=422, detail=f"Filter '{k}' must be a non-empty string")
        if len(v) > 200:
            raise HTTPException(status_code=422, detail=f"Filter '{k}' value too long")


@router.get("", response_model=schemas.SearchResponse, summary="Unified academic search across authorized domains")
@limiter.limit("60/minute")
def unified_search(
    request: Request,
    q: str = Query("", max_length=MAX_QUERY_LENGTH),
    domains: Optional[str] = Query(None),
    filters: Optional[str] = Query(None),
    sort: str = Query("relevance"),
    page: int = Query(1, ge=1, le=MAX_PAGE),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    domain_list = _parse_domains(domains)
    filters_dict = _parse_filters(filters)
    sort = _validate_sort(sort)
    _validate_filters_whitelist(filters_dict, domain_list)

    response = UnifiedSearchService.search(
        db=db,
        ctx=context,
        q=q,
        domains=domain_list,
        filters=filters_dict,
        sort=sort,
        page=page,
        limit=limit,
    )
    return response
