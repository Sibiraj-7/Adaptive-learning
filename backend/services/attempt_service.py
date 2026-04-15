from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from db.connection import get_db
from db.schema import (
    COLLECTION_QUIZ_ASSIGNMENTS,
    COLLECTION_QUIZ_ATTEMPTS,
    COLLECTION_QUIZZES,
    COLLECTION_STUDENT_MASTERY,
    COLLECTION_USERS,
)
from services.errors import ServiceError
from services.question_service import get_questions_by_ids
from services.recommendation_service import generate_recommendation
from services.serialization import require_oid, serialize_doc


def _student_may_take(assignment: dict, student: dict) -> bool:
    if assignment.get("target_type") == "department":
        return (student.get("department") or "") == (assignment.get("department") or "")
    sids = assignment.get("student_ids") or []
    return student["_id"] in sids


def _blend_mastery(previous: float | None, new_frac: float) -> float:
    if previous is None:
        return new_frac
    return round(0.7 * previous + 0.3 * new_frac, 4)


def _topic_key(subject: str, topic: str) -> str:
    return f"{subject}::{topic}"


def submit_attempt(student_id: str, payload: dict) -> dict[str, Any]:
    sid = require_oid(student_id, "student_id")
    db = get_db()

    student = db[COLLECTION_USERS].find_one({"_id": sid, "role": "student"})
    if not student:
        raise ServiceError("Student not found", 403)

    quiz_id = require_oid(str(payload.get("quiz_id", "")), "quiz_id")
    assignment_id = require_oid(str(payload.get("assignment_id", "")), "assignment_id")
    answers_raw = payload.get("answers")
    if not isinstance(answers_raw, list):
        raise ServiceError("answers must be a list", 400)

    assignment = db[COLLECTION_QUIZ_ASSIGNMENTS].find_one({"_id": assignment_id})
    if not assignment or assignment.get("quiz_id") != quiz_id:
        raise ServiceError("Assignment not found for this quiz", 404)
    if not _student_may_take(assignment, student):
        raise ServiceError("This quiz is not assigned to you", 403)

    quiz = db[COLLECTION_QUIZZES].find_one({"_id": quiz_id})
    if not quiz:
        raise ServiceError("Quiz not found", 404)

    qids_order: list[ObjectId] = list(quiz.get("question_ids") or [])
    questions = get_questions_by_ids(qids_order)
    by_id = {q["_id"]: q for q in questions}
    if len(by_id) != len(qids_order):
        raise ServiceError("Quiz references missing questions", 500)

    answer_map: dict[str, str] = {}
    for item in answers_raw:
        if not isinstance(item, dict):
            continue
        qid = str(item.get("question_id", ""))
        sel = str(item.get("selected_option", "")).strip()
        if qid:
            answer_map[qid] = sel

    total_score = 0.0
    max_score = float(len(qids_order))
    topic_perf: dict[str, dict[str, float]] = {}

    for qoid in qids_order:
        q = by_id[qoid]
        topic = q.get("topic") or "General"
        subject = q.get("subject") or "__global__"
        label = _topic_key(subject, topic)
        if label not in topic_perf:
            topic_perf[label] = {"correct": 0.0, "total": 0.0}
        topic_perf[label]["total"] += 1.0
        chosen = answer_map.get(str(qoid), "")
        if chosen == (q.get("correct_answer") or ""):
            total_score += 1.0
            topic_perf[label]["correct"] += 1.0

    submitted_at = datetime.now(timezone.utc)

    subjects_topics: dict[str, list[str]] = {}
    for qoid in qids_order:
        q = by_id[qoid]
        subj = q.get("subject") or "__global__"
        top = q.get("topic") or "General"
        lst = subjects_topics.setdefault(subj, [])
        if top not in lst:
            lst.append(top)

    coll = db[COLLECTION_STUDENT_MASTERY]
    candidates: list[tuple[float, str]] = []

    for subj, unique_topics in subjects_topics.items():
        existing = coll.find_one({"student_id": sid, "subject": subj})
        prev_map = dict((existing or {}).get("topic_mastery") or {})

        for topic in unique_topics:
            label = _topic_key(subj, topic)
            perf = topic_perf.get(label, {"correct": 0.0, "total": 0.0})
            tot = perf.get("total") or 0.0
            new_frac = (perf.get("correct") or 0.0) / tot if tot else 0.0
            prev_map[topic] = _blend_mastery(prev_map.get(topic), new_frac)

        for topic in unique_topics:
            candidates.append((prev_map.get(topic, 0.0), topic))

        coll.update_one(
            {"student_id": sid, "subject": subj},
            {
                "$set": {
                    "topic_mastery": prev_map,
                    "updated_at": submitted_at,
                },
                "$setOnInsert": {"student_id": sid, "subject": subj},
            },
            upsert=True,
        )

    candidates.sort(key=lambda x: (x[0], x[1]))
    recommended_global = candidates[0][1] if candidates else ""
    current_topic = (quiz.get("topic") or "").strip() or recommended_global or "General"
    recommendation = generate_recommendation(current_topic, total_score, max_score)

    answers_stored = [
        {
            "question_id": qoid,
            "selected_option": answer_map.get(str(qoid), ""),
        }
        for qoid in qids_order
    ]

    attempt_doc = {
        "quiz_id": quiz_id,
        "student_id": sid,
        "assignment_id": assignment_id,
        "answers": answers_stored,
        "submitted_at": submitted_at,
        "total_score": total_score,
        "max_score": max_score,
        "topic_performance": topic_perf,
        "mastery": recommendation,
        "recommended_next_topic": recommendation["recommended_next_topic"],
    }
    ins = db[COLLECTION_QUIZ_ATTEMPTS].insert_one(attempt_doc)
    attempt_doc["_id"] = ins.inserted_id

    coll.update_many(
        {"student_id": sid},
        {"$set": {"last_attempt_id": ins.inserted_id}},
    )

    return {
        "attempt": serialize_doc(attempt_doc),
        "percentage": round(100.0 * total_score / max_score, 2) if max_score else 0.0,
        "topic_performance": topic_perf,
        "recommended_next_topic": recommendation["recommended_next_topic"],
    }
