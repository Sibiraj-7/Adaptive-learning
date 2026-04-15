from datetime import datetime, timezone

from bson import ObjectId

from db.connection import get_db
from db.schema import COLLECTION_QUESTIONS
from services.errors import ServiceError
from services.serialization import require_oid, serialize_doc, serialize_docs


def _normalize_question_fields(payload: dict) -> dict:
    subject = (payload.get("subject") or "").strip()
    topic = (payload.get("topic") or "").strip()
    difficulty = (payload.get("difficulty") or "").strip().lower()
    options = payload.get("options")
    correct = (payload.get("correct_answer") or "").strip()
    question_text = (payload.get("question_text") or "").strip()

    if not subject or not topic:
        raise ServiceError("subject and topic are required", 400)
    if difficulty not in ("easy", "medium", "hard"):
        raise ServiceError("difficulty must be easy, medium, or hard", 400)
    if not isinstance(options, list) or len(options) < 2:
        raise ServiceError("options must be a list with at least two items", 400)
    for opt in options:
        if not isinstance(opt, dict) or "key" not in opt or "text" not in opt:
            raise ServiceError('each option needs "key" and "text"', 400)
    keys = {str(o["key"]).strip() for o in options}
    if correct not in keys:
        raise ServiceError("correct_answer must match one option key", 400)

    return {
        "subject": subject,
        "topic": topic,
        "question_text": question_text,
        "difficulty": difficulty,
        "options": [
            {"key": str(o["key"]).strip(), "text": str(o["text"]).strip()}
            for o in options
        ],
        "correct_answer": correct,
    }


def create_question(teacher_id: str, payload: dict) -> dict:
    fields = _normalize_question_fields(payload)
    tid = require_oid(teacher_id, "teacher_id")
    doc = {
        "teacher_id": tid,
        **fields,
        "created_at": datetime.now(timezone.utc),
    }
    res = get_db()[COLLECTION_QUESTIONS].insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc) or {}


def update_question(teacher_id: str, question_id: str, payload: dict) -> dict:
    tid = require_oid(teacher_id, "teacher_id")
    qid = require_oid(question_id, "question_id")
    fields = _normalize_question_fields(payload)
    db = get_db()
    coll = db[COLLECTION_QUESTIONS]
    existing = coll.find_one({"_id": qid, "teacher_id": tid})
    if not existing:
        raise ServiceError("Question not found", 404)
    fields["updated_at"] = datetime.now(timezone.utc)
    coll.update_one({"_id": qid, "teacher_id": tid}, {"$set": fields})
    updated = coll.find_one({"_id": qid})
    return serialize_doc(updated) or {}


def delete_question(teacher_id: str, question_id: str) -> None:
    tid = require_oid(teacher_id, "teacher_id")
    qid = require_oid(question_id, "question_id")
    res = get_db()[COLLECTION_QUESTIONS].delete_one({"_id": qid, "teacher_id": tid})
    if res.deleted_count == 0:
        raise ServiceError("Question not found", 404)


def list_questions(teacher_id: str, subject: str | None, topic: str | None) -> list[dict]:
    tid = require_oid(teacher_id, "teacher_id")
    qfilter: dict = {"teacher_id": tid}
    if subject:
        qfilter["subject"] = subject.strip()
    if topic:
        qfilter["topic"] = topic.strip()
    cur = get_db()[COLLECTION_QUESTIONS].find(qfilter).sort("created_at", -1)
    return serialize_docs(list(cur))


def get_questions_by_ids(question_ids: list[ObjectId]) -> list[dict]:
    if not question_ids:
        return []
    cur = get_db()[COLLECTION_QUESTIONS].find({"_id": {"$in": question_ids}})
    return list(cur)
