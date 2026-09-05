import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

class Settings:
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./research_blueprint.db")
    APP_URL: str = os.getenv("APP_URL", "http://localhost:5173")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "auto")  # auto | fake | gemini
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "").lower() in ("1", "true", "yes") or os.getenv("ENVIRONMENT") == "production"
    SESSION_TTL_DAYS: int = int(os.getenv("SESSION_TTL_DAYS", "7"))
    _auto_create_raw = os.getenv("AUTO_CREATE_TABLES")
    AUTO_CREATE_TABLES: bool = (
        _auto_create_raw.lower() in ("1", "true", "yes")
        if _auto_create_raw is not None
        else os.getenv("ENVIRONMENT", "development") != "production"
    )
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()
    SLOW_REQUEST_MS: int = max(1, int(os.getenv("SLOW_REQUEST_MS", "1000")))
    TRUSTED_HOSTS: list[str] = [host.strip() for host in os.getenv("TRUSTED_HOSTS", "localhost,127.0.0.1").split(",") if host.strip()]
    if os.getenv("TESTING") == "True" and "testserver" not in TRUSTED_HOSTS:
        TRUSTED_HOSTS.append("testserver")
    SITE_GATE_PASSWORD: str = os.getenv("SITE_GATE_PASSWORD", "")
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175"
        ).split(",")
        if origin.strip()
    ]
    SMTP_HOST: str = os.getenv("SMTP_HOST", "").strip()
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587") or "587")
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "").strip()
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "").strip()
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")

    @property
    def expose_dev_secrets(self) -> bool:
        """Return raw reset/verify/invite tokens only in tests or when opted in.

        Staging and local servers no longer leak tokens just because
        ENVIRONMENT != production. Set EXPOSE_AUTH_TOKENS=1 for local
        flows that have no SMTP.
        """
        import sys
        if os.getenv("TESTING") == "True" or "pytest" in sys.modules:
            return True
        if self.ENVIRONMENT == "production":
            return False
        return os.getenv("EXPOSE_AUTH_TOKENS", "").lower() in ("1", "true", "yes")

    def validate_production(self) -> None:
        if self.ENVIRONMENT != "production":
            return
        errors: list[str] = []
        if self.AUTO_CREATE_TABLES:
            errors.append("AUTO_CREATE_TABLES must be false")
        if not self.COOKIE_SECURE:
            errors.append("COOKIE_SECURE must be true")
        if self.DATABASE_URL.startswith("sqlite"):
            errors.append("DATABASE_URL must use the production database")
        if not self.APP_URL.startswith("https://"):
            errors.append("APP_URL must use HTTPS")
        if not self.CORS_ORIGINS or any(origin == "*" or not origin.startswith("https://") for origin in self.CORS_ORIGINS):
            errors.append("CORS_ORIGINS must contain explicit HTTPS origins")
        if not self.TRUSTED_HOSTS or "*" in self.TRUSTED_HOSTS:
            errors.append("TRUSTED_HOSTS must contain explicit hosts")
        if errors:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(errors))

settings = Settings()
