from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import datetime

from ..db import get_db
from ..models import (
    UnifiedAcademicProfile, AcademicIdentifier, AcademicAffiliation,
    ScholarlyAsset, ScholarlyAssetContributor, ScholarlyAssetFile,
    UploadedFile, User, PublicationSubmission
)
from ..schemas import (
    UnifiedAcademicProfileResponse, UnifiedAcademicProfileUpsert,
    ScholarlyAssetResponse, ScholarlyAssetCreate,
    PublicProfileResponse, PublicScholarlyAssetResponse
)
from ..services.tenant_context import get_tenant_context, TenantContext
from ..services.storage import get_storage_provider, StorageProvider

router = APIRouter(prefix="/api/academic-foundation", tags=["academic-foundation"])


def calculate_profile_completeness(body: UnifiedAcademicProfileUpsert) -> int:
    score = 0
    # Preferred name: +20
    if body.preferred_name_ar and len(body.preferred_name_ar.strip()) > 2:
        score += 20
    elif body.preferred_name_en and len(body.preferred_name_en.strip()) > 2:
        score += 20

    # Email: +10
    if (body.institutional_email and "@" in body.institutional_email) or (body.public_email and "@" in body.public_email):
        score += 10

    # Specialization: +20 (+10 general, +10 specific)
    if body.general_specialization and len(body.general_specialization.strip()) > 2:
        score += 10
    if body.specific_specialization and len(body.specific_specialization.strip()) > 2:
        score += 10

    # Biography: +30 (+15 short, +15 full)
    if body.short_bio_ar and len(body.short_bio_ar.strip()) > 15:
        score += 15
    elif body.short_bio_en and len(body.short_bio_en.strip()) > 15:
        score += 15
        
    if body.full_bio_ar and len(body.full_bio_ar.strip()) > 50:
        score += 15
    elif body.full_bio_en and len(body.full_bio_en.strip()) > 50:
        score += 15

    # Channels/Identifiers: +10 (at least one linked identifier)
    if body.identifiers and len(body.identifiers) > 0:
        score += 10

    # Affiliations: +10 (at least one affiliation)
    if body.affiliations and len(body.affiliations) > 0:
        score += 10

    return score


def compute_publication_provenance(db: Session, asset_ids: List[str]) -> dict:
    """{asset_id: True} for every id with at least one real PublicationSubmission.

    Computed live rather than stored: a persisted flag would need active
    synchronization if a submission is later withdrawn/cancelled, and this
    query is cheap at this table's scale. No migration, no backfill, no
    staleness window.
    """
    if not asset_ids:
        return {}
    rows = db.query(PublicationSubmission.asset_id).filter(
        PublicationSubmission.asset_id.in_(asset_ids)
    ).distinct().all()
    return {row[0]: True for row in rows}


def publication_provenance_label(lifecycle_status: str, has_real_submission: bool) -> Optional[str]:
    """Truthful publication provenance — never client-settable (no input
    schema field exists for it anywhere). None before PUBLISHED: there is no
    publication claim yet to attribute provenance to."""
    if lifecycle_status != "PUBLISHED":
        return None
    return "BASEERAH_PIPELINE_VERIFIED" if has_real_submission else "SELF_DECLARED"


@router.get("/public/{username}", response_model=PublicProfileResponse)
def get_public_profile(username: str, db: Session = Depends(get_db)):
    """Unauthenticated, read-only profile view for sharing outside the platform."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = db.query(UnifiedAcademicProfile).filter(
        UnifiedAcademicProfile.user_id == user.id
    ).first()

    if not profile or profile.visibility_status != "PUBLIC":
        raise HTTPException(status_code=404, detail="Profile not found")

    # PUBLISHED-only rule: ACCEPTED (or DRAFT/UNDER_REVIEW/ARCHIVED) must never
    # surface on the public profile just because visibility defaults to PUBLIC —
    # only an asset the owner (self-declared) or the real submission pipeline
    # (Baseerah-native manuscripts) has actually marked PUBLISHED may appear.
    assets = db.query(ScholarlyAsset).filter(
        ScholarlyAsset.owner_user_id == user.id,
        ScholarlyAsset.visibility == "PUBLIC",
        ScholarlyAsset.lifecycle_status == "PUBLISHED"
    ).order_by(ScholarlyAsset.publication_date.desc()).all()

    submitted = compute_publication_provenance(db, [a.id for a in assets])
    public_assets = []
    for a in assets:
        item = PublicScholarlyAssetResponse.model_validate(a)
        item.publication_verification_status = publication_provenance_label(
            a.lifecycle_status, a.id in submitted
        )
        public_assets.append(item)

    return PublicProfileResponse(
        has_photo=bool(profile.profile_photo_file_id),
        preferred_name_ar=profile.preferred_name_ar,
        preferred_name_en=profile.preferred_name_en,
        academic_title=profile.academic_title,
        current_rank=profile.current_rank,
        country=profile.country,
        university=profile.university,
        college=profile.college,
        department=profile.department,
        general_specialization=profile.general_specialization,
        specific_specialization=profile.specific_specialization,
        discipline=profile.discipline,
        research_interests_json=profile.research_interests_json,
        keywords_ar_json=profile.keywords_ar_json,
        keywords_en_json=profile.keywords_en_json,
        public_email=profile.public_email,
        short_bio_ar=profile.short_bio_ar,
        short_bio_en=profile.short_bio_en,
        full_bio_ar=profile.full_bio_ar,
        full_bio_en=profile.full_bio_en,
        completeness_score=profile.completeness_score,
        identifiers=list(profile.identifiers),
        affiliations=list(profile.affiliations),
        scholarly_assets=public_assets,
    )


@router.get("/public/{username}/photo")
def get_public_profile_photo(
    username: str,
    db: Session = Depends(get_db),
    storage: StorageProvider = Depends(get_storage_provider)
):
    """Unauthenticated photo fetch for the public profile page only -
    does not use the shared, authenticated /storage/download endpoint."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Photo not found")

    profile = db.query(UnifiedAcademicProfile).filter(
        UnifiedAcademicProfile.user_id == user.id
    ).first()

    if not profile or profile.visibility_status != "PUBLIC" or not profile.profile_photo_file_id:
        raise HTTPException(status_code=404, detail="Photo not found")

    db_file = db.query(UploadedFile).filter(
        UploadedFile.id == profile.profile_photo_file_id
    ).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="Photo not found")

    if not storage.file_exists(db_file.storage_key):
        raise HTTPException(status_code=404, detail="Photo not found")

    full_path = storage.get_file_path(db_file.storage_key)
    return FileResponse(
        path=full_path,
        media_type=db_file.mime_type,
        headers={"X-Content-Type-Options": "nosniff"}
    )


@router.get("/profile/me", response_model=UnifiedAcademicProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    profile = db.query(UnifiedAcademicProfile).filter(
        UnifiedAcademicProfile.user_id == context.user.id
    ).first()

    if not profile:
        # Auto-create empty profile
        profile = UnifiedAcademicProfile(
            id=str(uuid.uuid4()),
            user_id=context.user.id,
            organization_id=context.organization.id if context.organization else None,
            preferred_name_ar="",
            preferred_name_en="",
            name_variants_json=[],
            academic_title="",
            current_rank="",
            target_rank="",
            country="",
            university="",
            college="",
            department="",
            general_specialization="",
            specific_specialization="",
            discipline="",
            research_interests_json=[],

            keywords_ar_json=[],
            keywords_en_json=[],
            institutional_email="",
            public_email="",
            phone="",
            short_bio_ar="",
            short_bio_en="",
            full_bio_ar="",
            full_bio_en="",
            profile_photo_file_id=None,
            visibility_status="PUBLIC",
            completeness_score=0,
            created_at=datetime.datetime.now(datetime.UTC).isoformat()
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return profile


@router.post("/profile/upsert", response_model=UnifiedAcademicProfileResponse)
def upsert_profile(
    body: UnifiedAcademicProfileUpsert,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    profile = db.query(UnifiedAcademicProfile).filter(
        UnifiedAcademicProfile.user_id == context.user.id
    ).first()

    now_str = datetime.datetime.now(datetime.UTC).isoformat()

    if not profile:
        profile = UnifiedAcademicProfile(
            id=str(uuid.uuid4()),
            user_id=context.user.id,
            created_at=now_str
        )
        db.add(profile)

    profile.organization_id = context.organization.id if context.organization else None
    profile.preferred_name_ar = body.preferred_name_ar
    profile.preferred_name_en = body.preferred_name_en
    profile.name_variants_json = body.name_variants_json
    profile.academic_title = body.academic_title
    profile.current_rank = body.current_rank
    profile.target_rank = body.target_rank
    profile.country = body.country
    profile.university = body.university
    profile.college = body.college
    profile.department = body.department
    profile.general_specialization = body.general_specialization
    profile.specific_specialization = body.specific_specialization
    profile.discipline = body.discipline
    profile.research_interests_json = body.research_interests_json

    profile.keywords_ar_json = body.keywords_ar_json
    profile.keywords_en_json = body.keywords_en_json
    profile.institutional_email = body.institutional_email
    profile.public_email = body.public_email
    profile.phone = body.phone
    profile.short_bio_ar = body.short_bio_ar
    profile.short_bio_en = body.short_bio_en
    profile.full_bio_ar = body.full_bio_ar
    profile.full_bio_en = body.full_bio_en
    profile.profile_photo_file_id = body.profile_photo_file_id
    profile.visibility_status = body.visibility_status or "PUBLIC"
    profile.completeness_score = calculate_profile_completeness(body)
    profile.updated_at = now_str

    # Update Identifiers. No real verification authority exists yet (no ORCID
    # OAuth or equivalent live provider — see AcademicVisibilityReports.tsx's
    # own "not available" disclaimer). A self-declared value must never be
    # accepted as VERIFIED just because the client's payload claims it is:
    # status/verification_method/verified_at/last_checked_at are therefore
    # always server-forced here, ignoring whatever the client sent for them.
    db.query(AcademicIdentifier).filter(AcademicIdentifier.profile_id == profile.id).delete()
    for ident in body.identifiers:
        db.add(AcademicIdentifier(
            id=str(uuid.uuid4()),
            profile_id=profile.id,
            identifier_type=ident.identifier_type,
            identifier_value=ident.identifier_value,
            profile_url=ident.profile_url,
            status="UNVERIFIED",
            verification_method="SELF_DECLARED",
            verified_at=None,
            last_checked_at=None,
            metadata_json=ident.metadata_json
        ))

    # Update Affiliations — same self-declared-only rule as identifiers above.
    db.query(AcademicAffiliation).filter(AcademicAffiliation.profile_id == profile.id).delete()
    for aff in body.affiliations:
        db.add(AcademicAffiliation(
            id=str(uuid.uuid4()),
            profile_id=profile.id,
            organization_name=aff.organization_name,
            university_id=aff.university_id,
            college=aff.college,
            department=aff.department,
            position_title=aff.position_title,
            academic_rank=aff.academic_rank,
            start_date=aff.start_date,
            end_date=aff.end_date,
            is_current=aff.is_current or False,
            country=aff.country,
            evidence_file_id=aff.evidence_file_id,
            verification_status="UNVERIFIED"
        ))

    db.commit()
    db.refresh(profile)
    return profile


@router.get("/scholarly-assets", response_model=List[ScholarlyAssetResponse])
def list_scholarly_assets(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    # Enforce multi-tenancy: Only assets belonging to current active organization, or owned by user
    query = db.query(ScholarlyAsset)
    if context.organization:
        query = query.filter(
            (ScholarlyAsset.organization_id == context.organization.id) | 
            (ScholarlyAsset.owner_user_id == context.user.id)
        )
    else:
        query = query.filter(ScholarlyAsset.owner_user_id == context.user.id)

    assets = query.order_by(ScholarlyAsset.created_at.desc()).all()
    submitted = compute_publication_provenance(db, [a.id for a in assets])
    results = []
    for a in assets:
        item = ScholarlyAssetResponse.model_validate(a)
        item.publication_verification_status = publication_provenance_label(
            a.lifecycle_status, a.id in submitted
        )
        results.append(item)
    return results


@router.post("/scholarly-assets", response_model=ScholarlyAssetResponse)
def create_scholarly_asset(
    body: ScholarlyAssetCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    now_str = datetime.datetime.now(datetime.UTC).isoformat()
    asset = ScholarlyAsset(
        id=str(uuid.uuid4()),
        organization_id=context.organization.id if context.organization else None,
        owner_user_id=context.user.id,
        created_by=context.user.id,
        title_ar=body.title_ar,
        title_en=body.title_en,
        abstract_ar=body.abstract_ar,
        abstract_en=body.abstract_en,
        asset_type=body.asset_type,
        lifecycle_status=body.lifecycle_status or "DRAFT",
        primary_discipline=body.primary_discipline,
        secondary_disciplines_json=body.secondary_disciplines_json or [],
        keywords_json=body.keywords_json or [],
        doi=body.doi,
        issn=body.issn,
        isbn=body.isbn,
        journal_name=body.journal_name,
        publisher=body.publisher,
        publication_date=body.publication_date,
        acceptance_date=body.acceptance_date,
        conference_name=body.conference_name,
        language=body.language or "ar",
        visibility=body.visibility or "PUBLIC",
        source_module=body.source_module or "FOUNDATION",
        source_record_id=body.source_record_id,
        parent_asset_id=body.parent_asset_id,
        version_number=1,
        metadata_json=body.metadata_json or {},
        created_at=now_str
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    # Add Contributors
    for cont in body.contributors:
        db.add(ScholarlyAssetContributor(
            id=str(uuid.uuid4()),
            asset_id=asset.id,
            user_id=cont.user_id,
            external_name=cont.external_name,
            orcid=cont.orcid,
            author_order=cont.author_order or 1,
            is_corresponding_author=cont.is_corresponding_author or False,
            contribution_roles_json=cont.contribution_roles_json or [],
            affiliation_text=cont.affiliation_text,
            contribution_percentage=cont.contribution_percentage,
            verified_status="UNVERIFIED"
        ))

    # Add Files
    for file_entry in body.files:
        db.add(ScholarlyAssetFile(
            id=str(uuid.uuid4()),
            asset_id=asset.id,
            file_id=file_entry.file_id,
            file_role=file_entry.file_role,
            version=file_entry.version or 1,
            is_primary=file_entry.is_primary or False,
            uploaded_by=context.user.id,
            created_at=now_str
        ))

    db.commit()
    db.refresh(asset)
    # A brand-new asset cannot yet have a PublicationSubmission (its id was
    # only just generated), so provenance is always self-declared-or-none.
    result = ScholarlyAssetResponse.model_validate(asset)
    result.publication_verification_status = publication_provenance_label(asset.lifecycle_status, False)
    return result


@router.put("/scholarly-assets/{asset_id}", response_model=ScholarlyAssetResponse)
def update_scholarly_asset(
    asset_id: str,
    body: ScholarlyAssetCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    asset = db.query(ScholarlyAsset).filter(ScholarlyAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.owner_user_id != context.user.id:
        raise HTTPException(status_code=403, detail="Only the owner can edit this asset")

    now_str = datetime.datetime.now(datetime.UTC).isoformat()

    # Once an asset has entered the real editorial pipeline (a
    # PublicationSubmission exists for it), its lifecycle_status is
    # Publication's source of truth, not a self-service claim — the owner
    # editing their profile portfolio must not be able to hand-set
    # ACCEPTED/PUBLISHED and bypass peer review. For an asset never
    # submitted through that pipeline, the field is a self-declaration
    # (e.g. an externally-published paper), same as any CV entry.
    has_real_submission = db.query(PublicationSubmission.id).filter(
        PublicationSubmission.asset_id == asset.id
    ).first() is not None
    if not has_real_submission:
        asset.lifecycle_status = body.lifecycle_status or "DRAFT"

    asset.title_ar = body.title_ar
    asset.title_en = body.title_en
    asset.abstract_ar = body.abstract_ar
    asset.abstract_en = body.abstract_en
    asset.asset_type = body.asset_type
    asset.primary_discipline = body.primary_discipline
    asset.secondary_disciplines_json = body.secondary_disciplines_json or []
    asset.keywords_json = body.keywords_json or []
    asset.doi = body.doi
    asset.issn = body.issn
    asset.isbn = body.isbn
    asset.journal_name = body.journal_name
    asset.publisher = body.publisher
    asset.publication_date = body.publication_date
    asset.acceptance_date = body.acceptance_date
    asset.conference_name = body.conference_name
    asset.language = body.language or "ar"
    asset.visibility = body.visibility or "PUBLIC"
    asset.metadata_json = body.metadata_json or {}
    asset.updated_at = now_str
    db.commit()

    # Replace contributors wholesale, mirroring the profile upsert pattern
    db.query(ScholarlyAssetContributor).filter(ScholarlyAssetContributor.asset_id == asset.id).delete()
    for cont in body.contributors:
        db.add(ScholarlyAssetContributor(
            id=str(uuid.uuid4()),
            asset_id=asset.id,
            user_id=cont.user_id,
            external_name=cont.external_name,
            orcid=cont.orcid,
            author_order=cont.author_order or 1,
            is_corresponding_author=cont.is_corresponding_author or False,
            contribution_roles_json=cont.contribution_roles_json or [],
            affiliation_text=cont.affiliation_text,
            contribution_percentage=cont.contribution_percentage,
            verified_status="UNVERIFIED"
        ))

    db.commit()
    db.refresh(asset)
    result = ScholarlyAssetResponse.model_validate(asset)
    result.publication_verification_status = publication_provenance_label(asset.lifecycle_status, has_real_submission)
    return result


@router.get("/scholarly-assets/{asset_id}", response_model=ScholarlyAssetResponse)
def get_scholarly_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    asset = db.query(ScholarlyAsset).filter(ScholarlyAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Enforce multi-tenancy
    if context.organization and asset.organization_id != context.organization.id and asset.owner_user_id != context.user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this asset")
    elif not context.organization and asset.owner_user_id != context.user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this asset")

    has_real_submission = db.query(PublicationSubmission.id).filter(
        PublicationSubmission.asset_id == asset.id
    ).first() is not None
    result = ScholarlyAssetResponse.model_validate(asset)
    result.publication_verification_status = publication_provenance_label(asset.lifecycle_status, has_real_submission)
    return result


@router.delete("/scholarly-assets/{asset_id}")
def delete_scholarly_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    asset = db.query(ScholarlyAsset).filter(ScholarlyAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Only owner can delete
    if asset.owner_user_id != context.user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete this asset")

    db.delete(asset)
    db.commit()
    return {"ok": True}

