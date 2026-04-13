import os
from pathlib import Path

class Config:
    """Default configuration for local development."""

    # Secret key
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-change-in-production")

    # MongoDB configuration
    MONGODB_URI = os.environ.get(
        "MONGODB_URI",
        "mongodb://localhost:27017/adaptive_learning",
    )
    MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "adaptive_learning")

    # JSON behavior
    JSON_SORT_KEYS = False

    # File upload settings (for materials)
    BASE_DIR = Path(__file__).resolve().parent
    MATERIALS_UPLOAD_DIR = BASE_DIR / "uploads" / "materials"

    MATERIALS_MAX_UPLOAD_BYTES = int(
        os.environ.get("MATERIALS_MAX_UPLOAD_BYTES", 25 * 1024 * 1024)
    )