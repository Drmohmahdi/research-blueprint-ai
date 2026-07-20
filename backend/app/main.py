from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from .db import engine, Base
from .config import settings
from .routers import projects, analyzer, stats, auth, prediction, comments, organizations, storage, analytics, notifications, academic_visibility, academic_foundation


# Local development convenience; production schema changes should go through Alembic.
if settings.AUTO_CREATE_TABLES:
    Base.metadata.create_all(bind=engine)

import sys
import os

# Rate Limiter (disabled during testing to prevent 429 errors in test runs)
is_testing = "pytest" in sys.modules or os.getenv("TESTING") == "True"
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"], enabled=not is_testing)

app = FastAPI(
    title="Research Blueprint AI API",
    description="Backend services for Research Blueprint AI (Baseerah Academic Suite)",
    version="2.0.0"
)

# Rate Limit Error Handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(analyzer.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(prediction.router, prefix="/api")
app.include_router(comments.router)
app.include_router(organizations.router, prefix="/api")
app.include_router(storage.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(notifications.router)
app.include_router(academic_visibility.router)
app.include_router(academic_foundation.router)



@app.get("/")
@limiter.limit("30/minute")
def read_root(request: Request):
    return {"message": "Welcome to Research Blueprint AI API", "version": "2.0.0"}


@app.get("/health")
@limiter.limit("60/minute")
def health(request: Request):
    return {"status": "ok", "version": "2.0.0"}


@app.get("/ready")
@limiter.limit("60/minute")
def ready(request: Request):
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"status": "not_ready", "database": "error", "message": str(exc)}
        ) from exc
