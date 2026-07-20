from fastapi import APIRouter, Depends, HTTPException, status, Header, Cookie, Response, Request
from sqlalchemy.orm import Session
from ..db import get_db
from ..config import settings
from ..models import User, UserSession, AuditLog
from ..schemas import UserRegister, UserLogin, UserResponse, SessionResponse
import secrets
import datetime
import hashlib
import os
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional

import sys
is_testing = "pytest" in sys.modules or os.getenv("TESTING") == "True"
limiter = Limiter(key_func=get_remote_address, enabled=not is_testing)

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
    token = session_token
    if not isinstance(token, str):
        token = None
    if not token:
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
            
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
    allowed_roles = ["Researcher", "Student", "Supervisor", "Statistician", "OrganizationAdmin"]
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
        created_at=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(user)
    db.commit()
    
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
    
    return user

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
    response.delete_cookie("session_token")
    return {"message": "Logged out successfully"}

