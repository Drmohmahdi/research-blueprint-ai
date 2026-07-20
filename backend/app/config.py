import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

class Settings:
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./research_blueprint.db")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "").lower() in ("1", "true", "yes") or os.getenv("ENVIRONMENT") == "production"
    SESSION_TTL_DAYS: int = int(os.getenv("SESSION_TTL_DAYS", "7"))
    AUTO_CREATE_TABLES: bool = os.getenv("AUTO_CREATE_TABLES", "").lower() in ("1", "true", "yes") or os.getenv("ENVIRONMENT", "development") != "production"
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175"
        ).split(",")
        if origin.strip()
    ]

settings = Settings()
