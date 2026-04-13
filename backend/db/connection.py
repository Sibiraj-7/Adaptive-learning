"""MongoDB client singleton and initialization."""

from pymongo import MongoClient
from pymongo.database import Database

from config import Config

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(
            Config.MONGODB_URI,
            serverSelectionTimeoutMS=5000,
        )
    return _client


def get_db() -> Database:
    return get_client()[Config.MONGODB_DB_NAME]


def init_db() -> None:
    """Initialize database connection (basic check)."""
    import warnings

    db = get_db()
    try:
        db.command("ping")
        print("MongoDB connected successfully")
    except Exception as exc:
        warnings.warn(
            f"MongoDB not reachable: {exc}",
            stacklevel=1,
        )