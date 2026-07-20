from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
import uuid
from datetime import datetime, timezone

from ..db import get_db
from ..models import AcademicIdentityProfile, AcademicChannel
from ..services.tenant_context import get_tenant_context, TenantContext

router = APIRouter(prefix="/api/academic-visibility", tags=["academic-visibility"])


class ChannelSchema(BaseModel):
    channelName: str
    profileUrl: Optional[str] = None
    externalId: Optional[str] = None
    status: str
    completenessScore: int


class ProfileUpsert(BaseModel):
    userId: str
    preferredNameAr: Optional[str] = None
    preferredNameEn: Optional[str] = None
    nameVariants: Optional[str] = None
    discipline: Optional[str] = None
    researchInterests: Optional[str] = None
    keywords: Optional[str] = None
    shortBio: Optional[str] = None
    fullBio: Optional[str] = None
    channels: List[ChannelSchema] = []


@router.get("/profile/{user_id}")
def get_visibility_profile(
    user_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    profile = db.query(AcademicIdentityProfile).filter(
        AcademicIdentityProfile.userId == user_id
    ).first()

    if not profile:
        profile = AcademicIdentityProfile(
            id=str(uuid.uuid4()),
            userId=user_id,
            preferredNameAr="",
            preferredNameEn="",
            nameVariants="",
            discipline="",
            researchInterests="",
            keywords="",
            shortBio="",
            fullBio="",
            createdAt=datetime.now(timezone.utc).isoformat()
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    channels = db.query(AcademicChannel).filter(
        AcademicChannel.profileId == profile.id
    ).all()

    if not channels:
        defaults = [
            ("ORCID", "missing"), ("Google Scholar", "missing"),
            ("Scopus Author ID", "missing"), ("ResearchGate", "missing"),
            ("LinkedIn", "missing"), ("GitHub", "optional"),
        ]
        for c_name, c_status in defaults:
            db.add(AcademicChannel(
                id=str(uuid.uuid4()), profileId=profile.id,
                channelName=c_name, profileUrl="", externalId="",
                status=c_status, completenessScore=0, lastSync=None
            ))
        db.commit()
        channels = db.query(AcademicChannel).filter(
            AcademicChannel.profileId == profile.id
        ).all()

    return {
        "profile": {
            "id": profile.id, "userId": profile.userId,
            "preferredNameAr": profile.preferredNameAr,
            "preferredNameEn": profile.preferredNameEn,
            "nameVariants": profile.nameVariants,
            "discipline": profile.discipline,
            "researchInterests": profile.researchInterests,
            "keywords": profile.keywords,
            "shortBio": profile.shortBio, "fullBio": profile.fullBio,
            "createdAt": profile.createdAt
        },
        "channels": [
            {"id": c.id, "channelName": c.channelName,
             "profileUrl": c.profileUrl, "externalId": c.externalId,
             "status": c.status, "completenessScore": c.completenessScore,
             "lastSync": c.lastSync}
            for c in channels
        ]
    }


@router.post("/profile")
def upsert_visibility_profile(
    body: ProfileUpsert,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    profile = db.query(AcademicIdentityProfile).filter(
        AcademicIdentityProfile.userId == body.userId
    ).first()

    if not profile:
        profile = AcademicIdentityProfile(
            id=str(uuid.uuid4()), userId=body.userId,
            createdAt=datetime.now(timezone.utc).isoformat()
        )
        db.add(profile)

    profile.preferredNameAr = body.preferredNameAr
    profile.preferredNameEn = body.preferredNameEn
    profile.nameVariants = body.nameVariants
    profile.discipline = body.discipline
    profile.researchInterests = body.researchInterests
    profile.keywords = body.keywords
    profile.shortBio = body.shortBio
    profile.fullBio = body.fullBio
    db.commit()
    db.refresh(profile)

    db.query(AcademicChannel).filter(AcademicChannel.profileId == profile.id).delete()
    for ch in body.channels:
        db.add(AcademicChannel(
            id=str(uuid.uuid4()), profileId=profile.id,
            channelName=ch.channelName, profileUrl=ch.profileUrl,
            externalId=ch.externalId, status=ch.status,
            completenessScore=ch.completenessScore,
            lastSync=datetime.now(timezone.utc).isoformat()
        ))
    db.commit()
    return {"ok": True, "profileId": profile.id}
