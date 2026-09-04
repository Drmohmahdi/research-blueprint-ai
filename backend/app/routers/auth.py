from fastapi import APIRouter, Depends, HTTPException, status, Header, Cookie, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..db import get_db
from ..config import settings
from ..models import User, UserSession, AuditLog, PasswordResetToken, EmailVerificationToken
from ..schemas import UserRegister, UserLogin, UserResponse, SessionResponse, PasswordForgotRequest, PasswordResetRequest, EmailVerifyRequest
from ..services.notifications.email_adapter import EmailMessage, get_email_adapter
import secrets
import datetime
import hashlib
import os
from typing import Optional

from ..rate_limit import limiter, is_testing

router = APIRouter(prefix="/auth", tags=["auth"])


def _parse_session_expiry(expires_at: str) -> datetime.datetime:
    expiry = datetime.datetime.fromisoformat(expires_at)
    if expiry.tzinfo is None:
        return expiry.replace(tzinfo=datetime.UTC)
    return expiry

# NIST PBKDF2 Password Hashing Utility
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    # 100,000 iterations PBKDF2-HMAC-SHA256
    hash_val = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ":" + hash_val.hex()

def verify_password(stored_password: str, provided_password: str) -> bool:
    try:
        salt_hex, hash_hex = stored_password.split(":")
        salt = bytes.fromhex(salt_hex)
        hash_val = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100000)
        return hash_val.hex() == hash_hex
    except Exception:
        return False

# Session Helper: Creates a session for a user
def create_session(db: Session, user_id: str) -> UserSession:
    token = secrets.token_hex(32)
    expires_at = (
        datetime.datetime.now(datetime.UTC)
        + datetime.timedelta(days=settings.SESSION_TTL_DAYS)
    ).isoformat()
    session = UserSession(token=token, userId=user_id, expiresAt=expires_at)
    db.add(session)
    db.commit()
    return session

# Dependency to secure API endpoints
def get_current_user(
    authorization: str = Header(None),
    session_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
) -> User:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif isinstance(session_token, str) and session_token:
        token = session_token
            
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
        
    session = db.query(UserSession).filter(UserSession.token == token).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid"
        )
    
    # Check expiry
    expiry = _parse_session_expiry(session.expiresAt)
    if datetime.datetime.now(datetime.UTC) > expiry:
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired"
        )
    
    user = db.query(User).filter(User.id == session.userId).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    from ..services.rbac import ACCOUNT_STATUS_DISABLED, account_status_of
    if account_status_of(user) == ACCOUNT_STATUS_DISABLED:
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    return user

@router.post("/register", response_model=UserResponse)
@limiter.limit("5/minute")
def register(request: Request, params: UserRegister, db: Session = Depends(get_db)):
    # Validate existing username
    existing_user = db.query(User).filter(User.username == params.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Validate password strength
    if len(params.password) < 8 or not any(c.isalpha() for c in params.password) or not any(c.isdigit() for c in params.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long and contain both letters and numbers."
        )

    # Prevent public registration of administrative roles
    if params.role in ["SystemAdmin", "Developer", "admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative roles cannot be registered via public endpoints. Please use the backend provisioning tool."
        )

    # Validate role
    allowed_roles = ["Researcher", "Student", "Supervisor", "Statistician"]
    if params.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of {allowed_roles}"
        )
        
    user_id = secrets.token_hex(8)
    hashed = hash_password(params.password)
    user = User(
        id=user_id,
        username=params.username,
        hashed_password=hashed,
        email=params.email,
        role=params.role,
        account_status="ACTIVE",
        created_at=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(user)
    db.commit()

    raw_verify = _issue_email_verification(db, user)
    
    # Add Audit log
    audit = AuditLog(
        id=secrets.token_hex(8),
        userId=user_id,
        action="REGISTER",
        details=f"User {params.username} registered with role {params.role}",
        timestamp=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(audit)
    db.commit()

    from ..services.rbac import build_access_profile
    profile = build_access_profile(db, user, None)
    if is_testing or settings.ENVIRONMENT != "production":
        profile["verification_token"] = raw_verify
    return profile

@router.post("/login", response_model=SessionResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
    params: UserLogin,
    response: Response,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == params.username).first()
    if not user or not verify_password(user.hashed_password, params.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    from ..services.rbac import ACCOUNT_STATUS_DISABLED, account_status_of
    if account_status_of(user) == ACCOUNT_STATUS_DISABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    # Create session
    session = create_session(db, user.id)
    
    # Set HttpOnly Cookie
    response.set_cookie(
        key="session_token",
        value=session.token,
        httponly=True,
        max_age=settings.SESSION_TTL_DAYS * 24 * 60 * 60,
        samesite="lax",
        secure=settings.COOKIE_SECURE
    )
    
    # Add Audit log
    audit = AuditLog(
        id=secrets.token_hex(8),
        userId=user.id,
        action="LOGIN",
        details=f"User {user.username} logged in successfully",
        timestamp=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(audit)
    db.commit()
    
    return SessionResponse(token=session.token, username=user.username, role=user.role)

@router.get("/me", response_model=UserResponse)
def read_current_user(
    user: User = Depends(get_current_user),
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-ID"),
    db: Session = Depends(get_db),
):
    from ..services.rbac import build_access_profile
    return build_access_profile(db, user, x_organization_id)


@router.post("/logout")
def logout(
    response: Response,
    authorization: str = Header(None),
    session_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        
    if token:
        session = db.query(UserSession).filter(UserSession.token == token).first()
        if session:
            # Audit logout
            audit = AuditLog(
                id=secrets.token_hex(8),
                userId=session.userId,
                action="LOGOUT",
                details="Logged out successfully",
                timestamp=datetime.datetime.now(datetime.UTC).isoformat()
            )
            db.add(audit)
            db.delete(session)
            db.commit()
            
    # Clear cookie
    response.delete_cookie(
        "session_token",
        path="/",
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        httponly=True,
    )
    return {"message": "Logged out successfully"}


def _hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _issue_email_verification(db: Session, user: User) -> str:
    raw = secrets.token_urlsafe(32)
    now = datetime.datetime.now(datetime.UTC)
    db.add(EmailVerificationToken(
        id=secrets.token_hex(8),
        userId=user.id,
        token_hash=_hash_reset_token(raw),
        expiresAt=(now + datetime.timedelta(hours=48)).isoformat(),
        createdAt=now.isoformat(),
    ))
    verify_url = f"{settings.APP_URL.rstrip('/')}/login?verify={raw}"
    get_email_adapter().send_email(EmailMessage(
        recipient_email=user.email,
        subject="Confirm your Baseerah email / تأكيد بريد بصيرة",
        body_text=(
            "Confirm your email to finish activating your academic account. This link expires in 48 hours.\n"
            f"{verify_url}\n\n"
            "أكد بريدك لإكمال تفعيل حسابك الأكاديمي. ينتهي الرابط خلال 48 ساعة."
        ),
        template_key="email_verification",
    ))
    return raw


@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, params: PasswordForgotRequest, db: Session = Depends(get_db)):
    """Always succeeds. The reset token is returned only outside production so tests can run without email."""
    email = (params.email or "").strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first() if email else None
    payload = {"ok": True, "detail": "If the account exists, a reset token was issued."}
    if not user:
        return payload
    raw = secrets.token_urlsafe(32)
    now = datetime.datetime.now(datetime.UTC)
    token = PasswordResetToken(
        id=secrets.token_hex(8),
        userId=user.id,
        token_hash=_hash_reset_token(raw),
        expiresAt=(now + datetime.timedelta(hours=1)).isoformat(),
        createdAt=now.isoformat(),
    )
    db.add(token)
    reset_url = f"{settings.APP_URL.rstrip('/')}/login?token={raw}"
    delivery = get_email_adapter().send_email(EmailMessage(
        recipient_email=user.email,
        subject="Reset your Baseerah password / إعادة تعيين كلمة المرور",
        body_text=(
            "Use this link to reset your password. It expires in one hour.\n"
            f"{reset_url}\n\n"
            "استخدم هذا الرابط لإعادة تعيين كلمة المرور. ينتهي خلال ساعة."
        ),
        template_key="password_reset",
    ))
    db.add(AuditLog(
        id=secrets.token_hex(8),
        userId=user.id,
        action="PASSWORD_RESET_REQUESTED",
        details=f"Password reset requested. email_status={delivery.status.value}",
        timestamp=now.isoformat(),
    ))
    db.commit()
    if is_testing or settings.ENVIRONMENT != "production":
        payload["reset_token"] = raw
    return payload


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, params: PasswordResetRequest, db: Session = Depends(get_db)):
    if len(params.new_password) < 8 or not any(c.isalpha() for c in params.new_password) or not any(c.isdigit() for c in params.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long and contain both letters and numbers."
        )
    token_hash = _hash_reset_token(params.token.strip())
    row = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
    now = datetime.datetime.now(datetime.UTC)
    if not row or row.usedAt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token is invalid")
    expiry = datetime.datetime.fromisoformat(row.expiresAt)
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=datetime.UTC)
    if now > expiry:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token has expired")
    user = db.query(User).filter(User.id == row.userId).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token is invalid")
    user.hashed_password = hash_password(params.new_password)
    row.usedAt = now.isoformat()
    db.query(UserSession).filter(UserSession.userId == user.id).delete()
    db.add(AuditLog(
        id=secrets.token_hex(8),
        userId=user.id,
        action="PASSWORD_RESET_COMPLETED",
        details="Password was reset and existing sessions were revoked",
        timestamp=now.isoformat(),
    ))
    db.commit()
    return {"ok": True}


@router.post("/verify-email")
@limiter.limit("10/minute")
def verify_email(request: Request, params: EmailVerifyRequest, db: Session = Depends(get_db)):
    token_hash = _hash_reset_token(params.token.strip())
    row = db.query(EmailVerificationToken).filter(EmailVerificationToken.token_hash == token_hash).first()
    now = datetime.datetime.now(datetime.UTC)
    if not row or row.usedAt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token is invalid")
    expiry = datetime.datetime.fromisoformat(row.expiresAt)
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=datetime.UTC)
    if now > expiry:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token has expired")
    user = db.query(User).filter(User.id == row.userId).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token is invalid")
    user.email_verified_at = now.isoformat()
    row.usedAt = now.isoformat()
    db.add(AuditLog(
        id=secrets.token_hex(8),
        userId=user.id,
        action="EMAIL_VERIFIED",
        details="Email address confirmed",
        timestamp=now.isoformat(),
    ))
    db.commit()
    return {"ok": True, "email_verified": True}


@router.post("/resend-verification")
@limiter.limit("5/minute")
def resend_verification(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if getattr(user, "email_verified_at", None):
        return {"ok": True, "email_verified": True}
    raw = _issue_email_verification(db, user)
    db.add(AuditLog(
        id=secrets.token_hex(8),
        userId=user.id,
        action="EMAIL_VERIFICATION_RESENT",
        details="Verification email reissued",
        timestamp=datetime.datetime.now(datetime.UTC).isoformat(),
    ))
    db.commit()
    payload = {"ok": True, "email_verified": False}
    if is_testing or settings.ENVIRONMENT != "production":
        payload["verification_token"] = raw
    return payload

