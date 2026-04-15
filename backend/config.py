import os
from pathlib import Path


class Config:

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-change-in-production")
    MONGODB_URI = os.environ.get(
        "MONGODB_URI",
        "mongodb://localhost:27017/adaptive_learning",
    )
    MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "adaptive_learning")
    JSON_SORT_KEYS = False

    MATERIALS_UPLOAD_DIR = Path(__file__).resolve().parent / "uploads" / "materials"
    MATERIALS_MAX_UPLOAD_BYTES = int(
        os.environ.get("MATERIALS_MAX_UPLOAD_BYTES", str(25 * 1024 * 1024))
    )
