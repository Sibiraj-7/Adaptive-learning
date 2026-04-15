from pymongo import MongoClient
from pymongo.database import Database

from config import Config
from db.schema import (
    COLLECTION_LEARNING_MATERIALS,
    COLLECTION_QUESTIONS,
    COLLECTION_QUIZ_ASSIGNMENTS,
    COLLECTION_QUIZ_ATTEMPTS,
    COLLECTION_QUIZZES,
    COLLECTION_STUDENT_MASTERY,
    COLLECTION_USERS,
)

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
    import warnings

    db = get_db()
    try:
        db.command("ping")
    except Exception as exc:  # noqa: BLE001 — startup must not block the whole app
        warnings.warn(
            f"MongoDB not reachable; skipping index creation: {exc}",
            stacklevel=1,
        )
        return

    db[COLLECTION_USERS].create_index("email", unique=True)

    db[COLLECTION_QUESTIONS].create_index([("teacher_id", 1), ("subject", 1)])
    db[COLLECTION_QUESTIONS].create_index("teacher_id")

    db[COLLECTION_QUIZZES].create_index("teacher_id")

    db[COLLECTION_QUIZ_ASSIGNMENTS].create_index("quiz_id")
    db[COLLECTION_QUIZ_ASSIGNMENTS].create_index("teacher_id")
    db[COLLECTION_QUIZ_ASSIGNMENTS].create_index("department")

    db[COLLECTION_QUIZ_ATTEMPTS].create_index(
        [("student_id", 1), ("quiz_id", 1)]
    )
    db[COLLECTION_QUIZ_ATTEMPTS].create_index("quiz_id")

    db[COLLECTION_STUDENT_MASTERY].create_index(
        [("student_id", 1), ("subject", 1)],
        unique=True,
    )

    db[COLLECTION_LEARNING_MATERIALS].create_index(
        [("subject", 1), ("topic", 1)]
    )
    db[COLLECTION_LEARNING_MATERIALS].create_index([("topic", 1), ("difficulty", 1)])
    db[COLLECTION_LEARNING_MATERIALS].create_index("uploaded_by")
