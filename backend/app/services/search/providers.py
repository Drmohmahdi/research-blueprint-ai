"""
Phase 09 — Domain Search Providers & UnifiedSearchService.

Each domain provider implements:
  - domain name
  - build_base(db, context)        -> authorized query
  - apply_q(query, context, q, q_norm, filters) -> ILIKE + identifier filter
  - apply_filters(query, context, filters)      -> whitelisted filter keys
  - order(query, sort, q_norm)     -> sort + deterministic tie-breaker
  - count(query)                   -> authorized count
  - page(query, offset, limit)     -> result rows
  - project(row, context)          -> SearchResultItem
"""
import math
from typing import List, Optional
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session, joinedload

from ... import models, schemas
from ...services.tenant_context import TenantContext
from ...services.billing import EntitlementService, FeatureKey
from .normalization import normalize_search_text, escape_like, canonical_doi, canonical_orcid

_CHAR = "\\"

# ── Domain provider registry ──────────────────────────────────────────────────

_PROVIDERS = {}


def register(provider_cls):
    instance = provider_cls()
    _PROVIDERS[instance.domain] = instance
    return instance


def get_provider(domain: str):
    return _PROVIDERS.get(domain)


def get_all_providers():
    return list(_PROVIDERS.values())


def get_entitled_providers(db: Session, org_id: str, domains: Optional[List[str]] = None):
    """Returns (entitled, hidden) providers, hiding premium domains the plan lacks."""
    entitled = []
    hidden = []
    for p in get_all_providers():
        if domains and p.domain not in domains:
            continue
        if p.required_feature_key:
            if not EntitlementService.check_feature(db, org_id, p.required_feature_key):
                hidden.append(p.domain)
                continue
        entitled.append(p)
    return entitled, hidden


# ── Provider base ──────────────────────────────────────────────────────────────

class BaseProvider:
    domain = ""
    required_feature_key = ""

    def build_base(self, db: Session, ctx: TenantContext):
        raise NotImplementedError

    def apply_q(self, query, ctx: TenantContext, q: str, q_norm: str, filters: dict):
        return query

    def apply_filters(self, query, ctx: TenantContext, filters: dict):
        return query

    def order(self, query, sort: str, q_norm: str):
        return query

    def count(self, query) -> int:
        return query.count()

    def page(self, query, offset: int, limit: int):
        return query.offset(offset).limit(limit).all()

    def project(self, row, ctx: TenantContext) -> schemas.SearchResultItem:
        raise NotImplementedError

    def filters_whitelist(self) -> set:
        return set()


# ── PROJECT ────────────────────────────────────────────────────────────────────

@register
class ProjectProvider(BaseProvider):
    domain = "PROJECT"

    def build_base(self, db, ctx):
        return db.query(models.ResearchProject).filter(
            models.ResearchProject.organizationId == ctx.organization.id
        )

    def apply_q(self, query, ctx, q, q_norm, filters):
        if not q:
            return query
        escaped = escape_like(q_norm, _CHAR)
        pattern = f"%{escaped}%"
        return query.filter(
            models.ResearchProject.search_text.ilike(pattern, escape=_CHAR)
        )

    def apply_filters(self, query, ctx, filters):
        sd = filters.get("study_design")
        if sd:
            query = query.filter(models.ResearchProject.studyDesign == sd)
        owner = filters.get("owner")
        if owner:
            query = query.filter(models.ResearchProject.userId == owner)
        return query

    def order(self, query, sort, q_norm):
        if sort == "title":
            return query.order_by(models.ResearchProject.titleEn.asc(), models.ResearchProject.id.asc())
        if sort == "newest":
            return query.order_by(models.ResearchProject.version.desc(), models.ResearchProject.id.asc())
        if sort == "oldest":
            return query.order_by(models.ResearchProject.version.asc(), models.ResearchProject.id.asc())
        if sort == "relevance" and q_norm:
            escaped = escape_like(q_norm, _CHAR)
            rank = case(
                (models.ResearchProject.search_text == q_norm, 100),
                (models.ResearchProject.search_text.ilike(escaped + "%", escape=_CHAR), 80),
                (models.ResearchProject.search_text.ilike("%" + escaped + "%", escape=_CHAR), 50),
                else_=0
            )
            return query.order_by(rank.desc(), models.ResearchProject.id.asc())
        return query.order_by(models.ResearchProject.id.asc())

    def project(self, row, ctx):
        title = row.titleAr or row.titleEn or ""
        subtitle = row.studyDesign or ""
        snippet = (row.descriptionAr or row.descriptionEn or "")[:160]
        return schemas.SearchResultItem(
            domain=self.domain, entity_id=row.id, title=title,
            subtitle=subtitle, snippet=snippet, updated_at=None,
            target="/app/research",
            metadata={"studyDesign": row.studyDesign, "version": row.version}
        )

    def filters_whitelist(self):
        return {"study_design", "owner"}


# ── LITERATURE ─────────────────────────────────────────────────────────────────

@register
class LiteratureProvider(BaseProvider):
    domain = "LITERATURE"

    def build_base(self, db, ctx):
        return db.query(models.LiteratureStudy).filter(
            models.LiteratureStudy.organizationId == ctx.organization.id
        )

    def apply_q(self, query, ctx, q, q_norm, filters):
        if not q:
            return query
        escaped = escape_like(q_norm, _CHAR)
        pattern = f"%{escaped}%"
        doi_canon = canonical_doi(q)
        cond = models.LiteratureStudy.search_text.ilike(pattern, escape=_CHAR)
        if doi_canon:
            cond = or_(cond, func.lower(models.LiteratureStudy.doi).like(f"%{doi_canon}%"))
        return query.filter(cond)

    def apply_filters(self, query, ctx, filters):
        yf = filters.get("year_from")
        yt = filters.get("year_to")
        if yf is not None:
            query = query.filter(models.LiteratureStudy.year >= yf)
        if yt is not None:
            query = query.filter(models.LiteratureStudy.year <= yt)
        src = filters.get("source")
        if src:
            query = query.filter(models.LiteratureStudy.source == src)
        return query

    def order(self, query, sort, q_norm):
        if sort == "year":
            return query.order_by(models.LiteratureStudy.year.desc(), models.LiteratureStudy.id.asc())
        if sort == "newest":
            return query.order_by(models.LiteratureStudy.createdAt.desc(), models.LiteratureStudy.id.asc())
        if sort == "oldest":
            return query.order_by(models.LiteratureStudy.createdAt.asc(), models.LiteratureStudy.id.asc())
        if sort == "title":
            return query.order_by(models.LiteratureStudy.author.asc(), models.LiteratureStudy.id.asc())
        if sort == "relevance" and q_norm:
            escaped = escape_like(q_norm, _CHAR)
            rank = case(
                (models.LiteratureStudy.search_text == q_norm, 100),
                (models.LiteratureStudy.search_text.ilike(escaped + "%", escape=_CHAR), 80),
                (models.LiteratureStudy.search_text.ilike("%" + escaped + "%", escape=_CHAR), 50),
                else_=0
            )
            return query.order_by(rank.desc(), models.LiteratureStudy.id.asc())
        return query.order_by(models.LiteratureStudy.id.asc())

    def project(self, row, ctx):
        title = row.author or ""
        subtitle = f"{row.source} ({row.year})" if row.source else str(row.year or "")
        snippet = (row.notes or "")[:160]
        return schemas.SearchResultItem(
            domain=self.domain, entity_id=row.id, title=title,
            subtitle=subtitle, snippet=snippet, status=None,
            updated_at=row.createdAt,
            target="/app/research/literature/synthesizer",
            metadata={"year": row.year, "source": row.source, "doi": row.doi}
        )

    def filters_whitelist(self):
        return {"year_from", "year_to", "source"}


# ── ASSET (ScholarlyAsset) ─────────────────────────────────────────────────────

@register
class AssetProvider(BaseProvider):
    domain = "ASSET"

    def build_base(self, db, ctx):
        # General Unified Search is not the internal workflow resource
        # discovery used by Publication Intelligence or Promotion's evidence
        # picker (neither references this provider at all — both query
        # ScholarlyAsset directly through their own dedicated endpoints).
        # For that reason this filter is intentionally narrower than
        # list_scholarly_assets in academic_foundation.py: a searcher may
        # always find their OWN assets regardless of status, but another
        # same-org member's asset is only discoverable once it is genuinely
        # PUBLISHED and PUBLIC — the same PUBLISHED-only rule already
        # enforced on the public profile projection. Cross-tenant assets
        # remain excluded entirely (organization_id gate on the "other
        # user" branch), consistent with every other Search provider.
        return db.query(models.ScholarlyAsset).filter(
            or_(
                models.ScholarlyAsset.owner_user_id == ctx.user.id,
                and_(
                    models.ScholarlyAsset.organization_id == ctx.organization.id,
                    models.ScholarlyAsset.lifecycle_status == "PUBLISHED",
                    models.ScholarlyAsset.visibility == "PUBLIC",
                ),
            ),
            models.ScholarlyAsset.deleted_at.is_(None),
        )

    def apply_q(self, query, ctx, q, q_norm, filters):
        if not q:
            return query
        escaped = escape_like(q_norm, _CHAR)
        pattern = f"%{escaped}%"
        doi_canon = canonical_doi(q)
        cond = models.ScholarlyAsset.search_text.ilike(pattern, escape=_CHAR)
        if doi_canon:
            cond = or_(cond, func.lower(models.ScholarlyAsset.doi).like(f"%{doi_canon}%"))
        return query.filter(cond)

    def apply_filters(self, query, ctx, filters):
        at = filters.get("asset_type")
        if at:
            query = query.filter(models.ScholarlyAsset.asset_type == at)
        dp = filters.get("doi_present")
        if dp is not None:
            if dp:
                query = query.filter(models.ScholarlyAsset.doi.isnot(None), models.ScholarlyAsset.doi != "")
            else:
                query = query.filter(or_(models.ScholarlyAsset.doi.is_(None), models.ScholarlyAsset.doi == ""))
        venue = filters.get("venue")
        if venue:
            query = query.filter(models.ScholarlyAsset.journal_name.ilike(f"%{venue}%"))
        return query

    def order(self, query, sort, q_norm):
        if sort == "year":
            return query.order_by(models.ScholarlyAsset.publication_date.desc(), models.ScholarlyAsset.id.asc())
        if sort == "newest":
            return query.order_by(models.ScholarlyAsset.created_at.desc(), models.ScholarlyAsset.id.asc())
        if sort == "oldest":
            return query.order_by(models.ScholarlyAsset.created_at.asc(), models.ScholarlyAsset.id.asc())
        if sort == "title":
            return query.order_by(models.ScholarlyAsset.title_en.asc(), models.ScholarlyAsset.id.asc())
        if sort == "relevance" and q_norm:
            escaped = escape_like(q_norm, _CHAR)
            rank = case(
                (models.ScholarlyAsset.search_text == q_norm, 100),
                (models.ScholarlyAsset.search_text.ilike(escaped + "%", escape=_CHAR), 80),
                (models.ScholarlyAsset.search_text.ilike("%" + escaped + "%", escape=_CHAR), 50),
                else_=0
            )
            return query.order_by(rank.desc(), models.ScholarlyAsset.id.asc())
        return query.order_by(models.ScholarlyAsset.id.asc())

    def project(self, row, ctx):
        title = row.title_ar or row.title_en or ""
        subtitle = row.journal_name or row.asset_type or ""
        snippet = (row.abstract_ar or row.abstract_en or "")[:160]
        return schemas.SearchResultItem(
            domain=self.domain, entity_id=row.id, title=title,
            subtitle=subtitle, snippet=snippet, status=row.lifecycle_status,
            updated_at=row.updated_at or row.created_at,
            target=f"/app/assets/{row.id}",
            metadata={"assetType": row.asset_type, "doi": row.doi, "venue": row.journal_name}
        )

    def filters_whitelist(self):
        return {"asset_type", "doi_present", "venue"}


# ── PROFILE (UnifiedAcademicProfile) ──────────────────────────────────────────

@register
class ProfileProvider(BaseProvider):
    domain = "PROFILE"

    def build_base(self, db, ctx):
        # joinedload avoids an N+1 lazy-load of .user in project() (needed
        # there to build the public-profile navigation target — see below).
        return db.query(models.UnifiedAcademicProfile).options(
            joinedload(models.UnifiedAcademicProfile.user)
        ).filter(
            models.UnifiedAcademicProfile.organization_id == ctx.organization.id,
            or_(
                models.UnifiedAcademicProfile.user_id == ctx.user.id,
                models.UnifiedAcademicProfile.visibility_status == "PUBLIC",
            ),
        )

    def apply_q(self, query, ctx, q, q_norm, filters):
        if not q:
            return query
        escaped = escape_like(q_norm, _CHAR)
        pattern = f"%{escaped}%"
        orcid_canon = canonical_orcid(q)
        cond = models.UnifiedAcademicProfile.search_text.ilike(pattern, escape=_CHAR)
        if orcid_canon:
            subq = select(models.AcademicIdentifier.profile_id).where(
                models.AcademicIdentifier.identifier_type == "ORCID",
                func.upper(func.replace(models.AcademicIdentifier.identifier_value, " ", "")).like(
                    f"%{orcid_canon.replace(' ', '')}%"
                ),
            )
            cond = or_(cond, models.UnifiedAcademicProfile.id.in_(subq))
        return query.filter(cond)

    def apply_filters(self, query, ctx, filters):
        rk = filters.get("current_rank")
        if rk:
            query = query.filter(models.UnifiedAcademicProfile.current_rank == rk)
        return query

    def order(self, query, sort, q_norm):
        if sort == "newest":
            return query.order_by(models.UnifiedAcademicProfile.updated_at.desc(), models.UnifiedAcademicProfile.id.asc())
        if sort == "oldest":
            return query.order_by(models.UnifiedAcademicProfile.updated_at.asc(), models.UnifiedAcademicProfile.id.asc())
        if sort == "title":
            return query.order_by(models.UnifiedAcademicProfile.preferred_name_en.asc(), models.UnifiedAcademicProfile.id.asc())
        if sort == "relevance" and q_norm:
            escaped = escape_like(q_norm, _CHAR)
            rank = case(
                (models.UnifiedAcademicProfile.search_text == q_norm, 100),
                (models.UnifiedAcademicProfile.search_text.ilike(escaped + "%", escape=_CHAR), 80),
                (models.UnifiedAcademicProfile.search_text.ilike("%" + escaped + "%", escape=_CHAR), 50),
                else_=0
            )
            return query.order_by(rank.desc(), models.UnifiedAcademicProfile.id.asc())
        return query.order_by(models.UnifiedAcademicProfile.id.asc())

    def project(self, row, ctx):
        title = row.preferred_name_ar or row.preferred_name_en or ""
        subtitle = row.academic_title or row.current_rank or ""
        snippet = (row.general_specialization or "")[:160]
        # A row here for a DIFFERENT user only ever reaches project() when
        # build_base()'s own filter already proved visibility_status ==
        # "PUBLIC" — so linking to their public profile route cannot leak
        # anything the public endpoint itself wouldn't already serve. Only
        # the caller's own row (any visibility) targets the private editor.
        if row.user_id == ctx.user.id:
            target = "/app/profile"
        else:
            username = row.user.username if row.user else None
            target = f"/researcher/{username}" if username else "/app/profile"
        return schemas.SearchResultItem(
            domain=self.domain, entity_id=row.id, title=title,
            subtitle=subtitle, snippet=snippet, status=row.visibility_status,
            updated_at=row.updated_at or row.created_at,
            target=target,
            metadata={"rank": row.current_rank, "department": row.department, "university": row.university}
        )

    def filters_whitelist(self):
        return {"current_rank"}


# ── PROMOTION ──────────────────────────────────────────────────────────────────

@register
class PromotionProvider(BaseProvider):
    domain = "PROMOTION"
    required_feature_key = FeatureKey.PROMOTION_ENGINE.value

    def build_base(self, db, ctx):
        # Matches promotions.py's has_org_oversight_access exactly: only a
        # real org-level OWNER/ORGANIZATION_ADMIN retains read-only
        # institutional visibility. SUPERVISOR and platform-wide admin status
        # grant nothing here — academic committee authority (and the search
        # visibility that mirrors it) is resource-scoped to an explicit
        # PromotionCommitteeAssignment, not a generic role.
        role = (ctx.membership.role or "").upper()
        if role in ["OWNER", "ORGANIZATION_ADMIN"]:
            return db.query(models.PromotionApplication).filter(
                models.PromotionApplication.organization_id == ctx.organization.id
            )
        committee_application_ids = db.query(models.PromotionCommitteeAssignment.application_id).filter(
            models.PromotionCommitteeAssignment.organization_id == ctx.organization.id,
            models.PromotionCommitteeAssignment.user_id == ctx.user.id,
            models.PromotionCommitteeAssignment.status == "ACTIVE",
        )
        return db.query(models.PromotionApplication).filter(
            models.PromotionApplication.organization_id == ctx.organization.id,
            (models.PromotionApplication.user_id == ctx.user.id) |
            (models.PromotionApplication.id.in_(committee_application_ids)),
        )

    def apply_q(self, query, ctx, q, q_norm, filters):
        if not q:
            return query
        escaped = escape_like(q_norm, _CHAR)
        pattern = f"%{escaped}%"
        return query.filter(
            models.PromotionApplication.search_text.ilike(pattern, escape=_CHAR)
        )

    def apply_filters(self, query, ctx, filters):
        st = filters.get("status")
        if st:
            query = query.filter(models.PromotionApplication.status == st)
        tr = filters.get("target_rank")
        if tr:
            query = query.filter(models.PromotionApplication.target_rank == tr)
        return query

    def order(self, query, sort, q_norm):
        if sort == "newest":
            return query.order_by(models.PromotionApplication.created_at.desc(), models.PromotionApplication.id.asc())
        if sort == "oldest":
            return query.order_by(models.PromotionApplication.created_at.asc(), models.PromotionApplication.id.asc())
        if sort == "title":
            return query.order_by(models.PromotionApplication.target_rank.asc(), models.PromotionApplication.id.asc())
        if sort == "relevance" and q_norm:
            escaped = escape_like(q_norm, _CHAR)
            rank = case(
                (models.PromotionApplication.search_text == q_norm, 100),
                (models.PromotionApplication.search_text.ilike(escaped + "%", escape=_CHAR), 80),
                (models.PromotionApplication.search_text.ilike("%" + escaped + "%", escape=_CHAR), 50),
                else_=0
            )
            return query.order_by(rank.desc(), models.PromotionApplication.id.asc())
        return query.order_by(models.PromotionApplication.id.asc())

    def project(self, row, ctx):
        # Readiness/points are private academic-dossier content, not
        # administrative metadata. For non-oversight roles, build_base()
        # already only returns rows the searcher owns or is committee-assigned
        # to, so every row reaching here is one they have full legitimate
        # access to. Oversight-role searchers (OWNER/ORGANIZATION_ADMIN) see
        # ALL org rows in build_base(), so only their own application gets
        # full detail in the search listing here — a row they are personally
        # committee-assigned to (but don't own) still gets the administrative
        # projection for simplicity; full detail remains available via the
        # dedicated GET /applications/{id} endpoint, which checks committee
        # membership directly.
        role = (ctx.membership.role or "").upper()
        is_oversight_role = role in ["OWNER", "ORGANIZATION_ADMIN"]
        has_full_access = (not is_oversight_role) or (row.user_id == ctx.user.id)
        title = f"{row.target_rank} ({row.status})"
        metadata = {"targetRank": row.target_rank, "currentRank": row.current_rank}
        if has_full_access:
            subtitle = f"Current: {row.current_rank} | Readiness: {row.readiness_percentage}%"
            metadata["readiness"] = row.readiness_percentage
        else:
            subtitle = f"Current: {row.current_rank} | Status: {row.status}"
        return schemas.SearchResultItem(
            domain=self.domain, entity_id=row.id, title=title,
            subtitle=subtitle, snippet=None, status=row.status,
            updated_at=row.updated_at or row.created_at,
            target="/app/promotion",
            metadata=metadata
        )

    def filters_whitelist(self):
        return {"status", "target_rank"}


# ── PEER REVIEW ────────────────────────────────────────────────────────────────

@register
class PeerReviewProvider(BaseProvider):
    domain = "PEER_REVIEW"
    required_feature_key = FeatureKey.PEER_REVIEW.value

    def build_base(self, db, ctx):
        role = (ctx.membership.role or "").upper()
        if role in ["OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR"]:
            return db.query(models.PeerReviewCase).filter(
                models.PeerReviewCase.organization_id == ctx.organization.id
            )
        # Author's own cases + cases where assigned as reviewer
        assigned = select(models.ReviewerAssignment.case_id).where(
            models.ReviewerAssignment.reviewer_user_id == ctx.user.id,
            models.ReviewerAssignment.status.notin_(["REVOKED", "DECLINED"]),
        )
        return db.query(models.PeerReviewCase).filter(
            models.PeerReviewCase.organization_id == ctx.organization.id,
            or_(
                models.PeerReviewCase.owner_user_id == ctx.user.id,
                models.PeerReviewCase.id.in_(assigned),
            ),
        )

    def apply_q(self, query, ctx, q, q_norm, filters):
        if not q:
            return query
        escaped = escape_like(q_norm, _CHAR)
        pattern = f"%{escaped}%"
        return query.filter(
            models.PeerReviewCase.search_text.ilike(pattern, escape=_CHAR)
        )

    def apply_filters(self, query, ctx, filters):
        st = filters.get("status")
        if st:
            query = query.filter(models.PeerReviewCase.status == st)
        ct = filters.get("case_type")
        if ct:
            query = query.filter(models.PeerReviewCase.case_type == ct)
        atm = filters.get("assigned_to_me")
        if atm:
            assigned = select(models.ReviewerAssignment.case_id).where(
                models.ReviewerAssignment.reviewer_user_id == ctx.user.id,
                models.ReviewerAssignment.status.notin_(["REVOKED", "DECLINED"]),
            )
            query = query.filter(models.PeerReviewCase.id.in_(assigned))
        return query

    def order(self, query, sort, q_norm):
        if sort == "newest":
            return query.order_by(models.PeerReviewCase.created_at.desc(), models.PeerReviewCase.id.asc())
        if sort == "oldest":
            return query.order_by(models.PeerReviewCase.created_at.asc(), models.PeerReviewCase.id.asc())
        if sort == "title":
            return query.order_by(models.PeerReviewCase.title_en.asc(), models.PeerReviewCase.id.asc())
        if sort == "relevance" and q_norm:
            escaped = escape_like(q_norm, _CHAR)
            rank = case(
                (models.PeerReviewCase.search_text == q_norm, 100),
                (models.PeerReviewCase.search_text.ilike(escaped + "%", escape=_CHAR), 80),
                (models.PeerReviewCase.search_text.ilike("%" + escaped + "%", escape=_CHAR), 50),
                else_=0
            )
            return query.order_by(rank.desc(), models.PeerReviewCase.id.asc())
        return query.order_by(models.PeerReviewCase.id.asc())

    def project(self, row, ctx):
        title = row.title_ar or row.title_en or ""
        subtitle = f"{row.case_type} | {row.status}"
        return schemas.SearchResultItem(
            domain=self.domain, entity_id=row.id, title=title,
            subtitle=subtitle, snippet=None, status=row.status,
            updated_at=row.updated_at or row.created_at,
            target="/app/peer-review",
            metadata={"caseType": row.case_type, "blindType": row.blind_type, "round": row.current_round_number}
        )

    def filters_whitelist(self):
        return {"status", "case_type", "assigned_to_me"}


# ── FILE ───────────────────────────────────────────────────────────────────────

@register
class FileProvider(BaseProvider):
    domain = "FILE"

    def build_base(self, db, ctx):
        role = (ctx.membership.role or "").upper()
        base = db.query(models.UploadedFile).filter(
            models.UploadedFile.organization_id == ctx.organization.id,
            models.UploadedFile.deleted_at.is_(None),
        )
        if role in ["OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR"]:
            return base
        # Mirror FileAccessPolicy: users see files they own, PUBLIC, project-owned, asset-owned, or manuscript-owned
        asset_files = select(models.ScholarlyAssetFile.file_id).where(
            models.ScholarlyAssetFile.asset_id.in_(
                select(models.ScholarlyAsset.id).where(
                    models.ScholarlyAsset.organization_id == ctx.organization.id,
                    or_(
                        models.ScholarlyAsset.owner_user_id == ctx.user.id,
                        models.ScholarlyAsset.visibility == "PUBLIC",
                    ),
                )
            )
        )
        manuscript_files = select(models.ManuscriptRevision.file_id).where(
            models.ManuscriptRevision.case_id.in_(
                select(models.PeerReviewCase.id).where(
                    models.PeerReviewCase.organization_id == ctx.organization.id,
                    models.PeerReviewCase.owner_user_id == ctx.user.id,
                )
            )
        )
        visible = or_(
            models.UploadedFile.uploaded_by == ctx.user.id,
            models.UploadedFile.classification == "PUBLIC",
            models.UploadedFile.project_id.in_(
                select(models.ResearchProject.id).where(
                    models.ResearchProject.organizationId == ctx.organization.id,
                    models.ResearchProject.userId == ctx.user.id,
                )
            ),
            models.UploadedFile.id.in_(asset_files),
            models.UploadedFile.id.in_(manuscript_files),
        )
        return base.filter(visible)

    def apply_q(self, query, ctx, q, q_norm, filters):
        if not q:
            return query
        escaped = escape_like(q_norm, _CHAR)
        pattern = f"%{escaped}%"
        return query.filter(
            models.UploadedFile.search_text.ilike(pattern, escape=_CHAR)
        )

    def apply_filters(self, query, ctx, filters):
        cf = filters.get("classification")
        if cf:
            query = query.filter(models.UploadedFile.classification == cf)
        return query

    def order(self, query, sort, q_norm):
        if sort == "newest":
            return query.order_by(models.UploadedFile.created_at.desc(), models.UploadedFile.id.asc())
        if sort == "oldest":
            return query.order_by(models.UploadedFile.created_at.asc(), models.UploadedFile.id.asc())
        if sort == "title":
            return query.order_by(models.UploadedFile.filename.asc(), models.UploadedFile.id.asc())
        if sort == "relevance" and q_norm:
            escaped = escape_like(q_norm, _CHAR)
            rank = case(
                (models.UploadedFile.search_text == q_norm, 100),
                (models.UploadedFile.search_text.ilike(escaped + "%", escape=_CHAR), 80),
                (models.UploadedFile.search_text.ilike("%" + escaped + "%", escape=_CHAR), 50),
                else_=0
            )
            return query.order_by(rank.desc(), models.UploadedFile.id.asc())
        return query.order_by(models.UploadedFile.id.asc())

    def project(self, row, ctx):
        title = row.filename or ""
        subtitle = row.mime_type or ""
        return schemas.SearchResultItem(
            domain=self.domain, entity_id=row.id, title=title,
            subtitle=subtitle, snippet=None, status=row.classification,
            updated_at=row.created_at,
            target=None,
            metadata={"mimeType": row.mime_type, "classification": row.classification, "sizeBytes": row.size_bytes}
        )

    def filters_whitelist(self):
        return {"classification"}


# ── THESIS (relationship-scoped; no confidential content is indexed) ─────────

@register
class ThesisProvider(BaseProvider):
    domain = "THESIS"

    def build_base(self, db, ctx):
        query = db.query(models.ThesisRecord).filter(models.ThesisRecord.organization_id == ctx.organization.id)
        if ctx.is_global_admin or (ctx.role or "").upper() in {"OWNER", "ORGANIZATION_ADMIN"}:
            return query
        assigned = select(models.ThesisSupervisionAssignment.thesis_id).where(
            models.ThesisSupervisionAssignment.organization_id == ctx.organization.id,
            models.ThesisSupervisionAssignment.user_id == ctx.user.id,
            models.ThesisSupervisionAssignment.status == "ACTIVE",
        )
        return query.filter(or_(models.ThesisRecord.student_user_id == ctx.user.id, models.ThesisRecord.id.in_(assigned)))

    def apply_q(self, query, ctx, q, q_norm, filters):
        if not q: return query
        pattern = f"%{escape_like(q_norm, _CHAR)}%"
        return query.filter(or_(func.lower(models.ThesisRecord.title_ar).ilike(pattern, escape=_CHAR), func.lower(models.ThesisRecord.title_en).ilike(pattern, escape=_CHAR), func.lower(models.ThesisRecord.program_name).ilike(pattern, escape=_CHAR), func.lower(models.ThesisRecord.degree_type).ilike(pattern, escape=_CHAR)))

    def apply_filters(self, query, ctx, filters):
        if filters.get("degree_type"): query=query.filter(models.ThesisRecord.degree_type==filters["degree_type"])
        if filters.get("thesis_stage"): query=query.filter(models.ThesisRecord.current_stage==filters["thesis_stage"])
        return query

    def order(self, query, sort, q_norm):
        if sort == "title": return query.order_by(models.ThesisRecord.title_en.asc(), models.ThesisRecord.id.asc())
        if sort == "oldest": return query.order_by(models.ThesisRecord.created_at.asc(), models.ThesisRecord.id.asc())
        return query.order_by(models.ThesisRecord.updated_at.desc(), models.ThesisRecord.id.asc())

    def project(self, row, ctx):
        return schemas.SearchResultItem(domain=self.domain, entity_id=row.id, title=row.title_ar or row.title_en, subtitle=f"{row.degree_type} · {row.program_name}", snippet=None, status=row.current_stage, updated_at=row.updated_at, target=f"/organizations/{row.organization_id}/projects/{row.project_id}/paths/thesis-defense", metadata={"degreeType":row.degree_type,"stage":row.current_stage,"program":row.program_name})

    def filters_whitelist(self): return {"degree_type", "thesis_stage"}


# ── UnifiedSearchService ──────────────────────────────────────────────────────

class UnifiedSearchService:

    @staticmethod
    def search(
        db: Session,
        ctx: TenantContext,
        q: str,
        domains: Optional[List[str]] = None,
        filters: Optional[dict] = None,
        sort: str = "relevance",
        page: int = 1,
        limit: int = 20,
    ) -> schemas.SearchResponse:
        filters = filters or {}
        q_norm = normalize_search_text(q) if q else ""
        q_clean = q.strip() if q else ""

        entitled, hidden = get_entitled_providers(db, ctx.organization.id, domains)
        domain_list = [p.domain for p in entitled]

        if not q_clean and not filters:
            return schemas.SearchResponse(
                query=q_clean, domains=domain_list, total=0, page=page, limit=limit,
                total_pages=0, results=[], domain_counts={}, hidden_domains=hidden,
            )

        all_results: List[schemas.SearchResultItem] = []
        domain_counts = {}
        total = 0

        for provider in entitled:
            query = provider.build_base(db, ctx)
            query = provider.apply_q(query, ctx, q_clean, q_norm, filters)
            query = provider.apply_filters(query, ctx, filters)
            query = provider.order(query, sort, q_norm)

            cnt = provider.count(query)
            domain_counts[provider.domain] = cnt
            total += cnt

            offset = (page - 1) * limit
            rows = provider.page(query, offset, limit)
            for row in rows:
                all_results.append(provider.project(row, ctx))

        total_pages = math.ceil(total / limit) if total > 0 else 0

        return schemas.SearchResponse(
            query=q_clean, domains=domain_list, total=total, page=page, limit=limit,
            total_pages=total_pages, results=all_results, domain_counts=domain_counts,
            hidden_domains=hidden,
        )
