from datetime import datetime, timezone
from typing import Any

from werkzeug.security import generate_password_hash

from db.connection import get_db
from db.schema import (
    COLLECTION_QUIZ_ATTEMPTS,
    COLLECTION_QUIZZES,
    COLLECTION_USERS,
)
from services.errors import ServiceError
from services.serialization import require_oid, serialize_doc, serialize_docs


ALLOWED_ROLES = ("teacher", "student")


def get_stats() -> dict[str, Any]:
    db = get_db()
    total_students = db[COLLECTION_USERS].count_documents({"role": "student"})
    total_teachers = db[COLLECTION_USERS].count_documents({"role": "teacher"})
    total_quizzes  = db[COLLECTION_QUIZZES].count_documents({})
    total_attempts = db[COLLECTION_QUIZ_ATTEMPTS].count_documents({})

    pipeline = [
        {"$match": {"role": "student", "department": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    dept_breakdown = [
        {"department": r["_id"], "count": r["count"]}
        for r in db[COLLECTION_USERS].aggregate(pipeline)
    ]

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_quizzes":  total_quizzes,
        "total_attempts": total_attempts,
        "dept_breakdown": dept_breakdown,
    }


def list_users(role: str) -> list[dict]:
    if role not in ALLOWED_ROLES:
        raise ServiceError(f"role must be one of {ALLOWED_ROLES}", 400)
    db = get_db()
    users = list(
        db[COLLECTION_USERS]
        .find({"role": role}, {"password_hash": 0})
        .sort("created_at", -1)
    )
    return serialize_docs(users)


def create_user(payload: dict) -> dict[str, Any]:
    role       = (payload.get("role") or "").strip().lower()
    email      = (payload.get("email") or "").strip().lower()
    password   = (payload.get("password") or "").strip()
    full_name  = (payload.get("full_name") or "").strip()
    department = (payload.get("department") or "").strip()

    if role not in ALLOWED_ROLES:
        raise ServiceError("role must be 'teacher' or 'student'", 400)
    if not email:
        raise ServiceError("email is required", 400)
    if not password or len(password) < 6:
        raise ServiceError("password must be at least 6 characters", 400)
    if not full_name:
        raise ServiceError("full_name is required", 400)

    db = get_db()
    if db[COLLECTION_USERS].find_one({"email": email}):
        raise ServiceError("A user with this email already exists", 409)

    doc = {
        "email":         email,
        "password_hash": generate_password_hash(password),
        "role":          role,
        "full_name":     full_name,
        "department":    department,
        "created_at":    datetime.now(timezone.utc),
    }
    res = db[COLLECTION_USERS].insert_one(doc)
    doc["_id"] = res.inserted_id
    doc.pop("password_hash", None)
    return serialize_doc(doc) or {}


def update_user(user_id: str, payload: dict) -> dict[str, Any]:
    uid  = require_oid(user_id, "user_id")
    db   = get_db()
    user = db[COLLECTION_USERS].find_one({"_id": uid})
    if not user:
        raise ServiceError("User not found", 404)

    updates: dict[str, Any] = {}

    full_name = (payload.get("full_name") or "").strip()
    if full_name:
        updates["full_name"] = full_name

    updates["department"] = (payload.get("department") or "").strip()

    email = (payload.get("email") or "").strip().lower()
    if email and email != user.get("email"):
        if db[COLLECTION_USERS].find_one({"email": email, "_id": {"$ne": uid}}):
            raise ServiceError("A user with this email already exists", 409)
        updates["email"] = email

    if not updates:
        raise ServiceError("No valid fields to update", 400)

    updates["updated_at"] = datetime.now(timezone.utc)
    db[COLLECTION_USERS].update_one({"_id": uid}, {"$set": updates})

    updated = db[COLLECTION_USERS].find_one({"_id": uid}, {"password_hash": 0})
    return serialize_doc(updated) or {}


def delete_user(user_id: str) -> dict[str, Any]:
    uid  = require_oid(user_id, "user_id")
    db   = get_db()
    user = db[COLLECTION_USERS].find_one({"_id": uid})
    if not user:
        raise ServiceError("User not found", 404)
    db[COLLECTION_USERS].delete_one({"_id": uid})
    return {"deleted": True, "user_id": user_id}


def reset_password(user_id: str, new_password: str) -> dict[str, Any]:
    if not new_password or len(new_password) < 6:
        raise ServiceError("Password must be at least 6 characters", 400)
    uid  = require_oid(user_id, "user_id")
    db   = get_db()
    user = db[COLLECTION_USERS].find_one({"_id": uid})
    if not user:
        raise ServiceError("User not found", 404)
    db[COLLECTION_USERS].update_one(
        {"_id": uid},
        {"$set": {"password_hash": generate_password_hash(new_password)}}
    )
    return {"reset": True, "user_id": user_id}