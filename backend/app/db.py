from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

# Configure SQLite/PostgreSQL connection string
connect_args = {}
engine_options = {"pool_pre_ping": True}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    engine_options.update(
        pool_size=max(1, int(__import__("os").getenv("DB_POOL_SIZE", "5"))),
        max_overflow=max(0, int(__import__("os").getenv("DB_MAX_OVERFLOW", "10"))),
        pool_timeout=max(1, int(__import__("os").getenv("DB_POOL_TIMEOUT", "30"))),
        pool_recycle=max(60, int(__import__("os").getenv("DB_POOL_RECYCLE", "1800"))),
    )

engine = create_engine(
    settings.DATABASE_URL, connect_args=connect_args, **engine_options
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
