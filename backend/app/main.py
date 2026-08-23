import logging
import os
import sys
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from .db import engine, Base
from .config import settings
from .observability import log_event, request_id_context
from .services.site_gate import GATE_COOKIE_NAME, get_expected_site_gate_token
from .routers import projects, analyzer, stats, auth, prediction, comments, organizations, storage, analytics, notifications, academic_visibility, academic_foundation, literature, promotions, peer_reviews, external_reviews, reports, billing, search, ai, admin, site_gate


settings.validate_production()

# Local development convenience; production schema changes are Alembic-only.
if settings.AUTO_CREATE_TABLES:
    Base.metadata.create_all(bind=engine)

# Rate Limiter (disabled during testing to prevent 429 errors in test runs)
is_testing = "pytest" in sys.modules or os.getenv("TESTING") == "True"
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"], enabled=not is_testing)

app = FastAPI(
    title="Research Blueprint AI API",
    description="Backend services for Research Blueprint AI (Baseerah Academic Suite)",
    version="3.0.0"
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
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.TRUSTED_HOSTS)

# Paths reachable without the temporary development site gate, regardless of
# whether SITE_GATE_PASSWORD is set. Keep this minimal — anything else is
# denied by default while the gate is enabled.
SITE_GATE_EXEMPT_PATHS = {"/health", "/ready", "/readiness", "/api/site-gate/status", "/api/site-gate/verify"}


@app.middleware("http")
async def operational_middleware(request: Request, call_next):
    incoming_request_id = request.headers.get("X-Request-ID", "")
    try:
        request_id = str(uuid.UUID(incoming_request_id)) if len(incoming_request_id) <= 64 else str(uuid.uuid4())
    except (ValueError, AttributeError):
        request_id = str(uuid.uuid4())
    token = request_id_context.set(request_id)
    request.state.request_id = request_id
    started = time.perf_counter()
    status_code = 500

    gate_token = get_expected_site_gate_token()
    if (
        gate_token
        and request.method != "OPTIONS"
        and request.url.path not in SITE_GATE_EXEMPT_PATHS
        and request.cookies.get(GATE_COOKIE_NAME) != gate_token
    ):
        response = JSONResponse(status_code=401, content={"detail": "SITE_GATED"})
        status_code = 401
    else:
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as exc:
            log_event(
                logging.ERROR,
                "http.request.unhandled_error",
                method=request.method,
                route=request.url.path,
                exception_type=type(exc).__name__,
            )
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
            )
    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    level = logging.WARNING if status_code >= 500 or duration_ms >= settings.SLOW_REQUEST_MS else logging.INFO
    log_event(
        level,
        "http.request.completed",
        method=request.method,
        route=request.url.path,
        status_code=status_code,
        duration_ms=duration_ms,
    )
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    request_id_context.reset(token)
    return response

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(literature.router, prefix="/api")
app.include_router(promotions.router, prefix="/api")
app.include_router(peer_reviews.router, prefix="/api")
app.include_router(external_reviews.router, prefix="/api")
app.include_router(reports.router)
app.include_router(analyzer.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(prediction.router, prefix="/api")
app.include_router(comments.router)
app.include_router(organizations.router, prefix="/api")
app.include_router(storage.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(notifications.router)
app.include_router(notifications.ws_router)
app.include_router(academic_visibility.router)
app.include_router(academic_foundation.router)
app.include_router(billing.router)
app.include_router(search.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(site_gate.router, prefix="/api")



@app.get("/")
@limiter.limit("30/minute")
def read_root(request: Request):
    return {"message": "Welcome to Research Blueprint AI API", "version": "3.0.0"}


@app.get("/health")
def health(request: Request):
    return {"status": "ok", "liveness": "alive", "version": "3.0.0"}


@app.get("/readiness")
def ready(request: Request):
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        storage_ready = bool(os.getenv("STORAGE_ROOT", "storage_files"))
        return {
            "status": "ready",
            "database": "ready",
            "storage": "ready" if storage_ready else "not_ready",
            "ai_live_provider": "configured" if settings.GEMINI_API_KEY else "not_configured",
            "payment_live_provider": "not_configured",
            "error_monitor": "not_configured",
        }
    except Exception as exc:
        log_event(logging.ERROR, "readiness.database.failed", exception_type=type(exc).__name__)
        return JSONResponse(status_code=503, content={"status": "not_ready", "database": "unavailable"})


@app.get("/ready", include_in_schema=False)
def ready_compat(request: Request):
    result = ready(request)
    if isinstance(result, JSONResponse):
        return result
    return {**result, "database": "ok"}
