from collections import Counter, defaultdict
from datetime import datetime, timezone

from bson import ObjectId

from db.connection import get_db
from db.schema import (
    COLLECTION_QUESTIONS,
    COLLECTION_QUIZ_ASSIGNMENTS,
    COLLECTION_QUIZ_ATTEMPTS,
    COLLECTION_QUIZZES,
    COLLECTION_USERS,
)
from services.errors import ServiceError
from services.question_service import get_questions_by_ids
from services.serialization import require_oid, serialize_doc, serialize_docs


ALLOWED_DIFFICULTIES = ("easy", "medium", "hard")


def _pick_majority(values: list[str], default: str) -> str:
    filtered = [v for v in values if isinstance(v, str) and v.strip()]
    if not filtered:
        return default
    return Counter(filtered).most_common(1)[0][0]


def _normalize_difficulty(raw: str | None) -> str | None:
    if raw is None:
        return None
    d = str(raw).strip().lower()
    if not d:
        return None
    return d


def _ensure_quiz_meta_from_questions(quiz: dict, questions_by_id: dict[ObjectId, dict]) -> dict:

    qids = quiz.get("question_ids") or []
    referenced = [questions_by_id.get(oid) for oid in qids if oid in questions_by_id]
    subjects = [q.get("subject") or "" for q in referenced]
    topics = [q.get("topic") or "" for q in referenced]
    diffs = [q.get("difficulty") or "" for q in referenced]

    if not quiz.get("subject"):
        quiz["subject"] = _pick_majority(subjects, default="__global__")
    if not quiz.get("topic"):
        quiz["topic"] = _pick_majority(topics, default="General")
    if not quiz.get("difficulty"):
        quiz["difficulty"] = _pick_majority(
            [d for d in diffs if d in ALLOWED_DIFFICULTIES], default="medium"
        )
    return quiz


def create_quiz(teacher_id: str, payload: dict) -> dict:
    title = (payload.get("title") or "").strip()
    raw_ids = payload.get("question_ids")
    if not title:
        raise ServiceError("title is required", 400)
    if not isinstance(raw_ids, list) or not raw_ids:
        raise ServiceError("question_ids must be a non-empty list", 400)

    tid = require_oid(teacher_id, "teacher_id")
    qids: list[ObjectId] = []
    for x in raw_ids:
        qids.append(require_oid(str(x), "question_id"))

    provided_subject = (payload.get("subject") or "").strip()
    provided_topic = (payload.get("topic") or "").strip()
    provided_difficulty = _normalize_difficulty(payload.get("difficulty"))

    if provided_difficulty is not None and provided_difficulty not in ALLOWED_DIFFICULTIES:
        raise ServiceError("difficulty must be easy, medium, or hard", 400)

    db = get_db()
    question_docs = list(
        db[COLLECTION_QUESTIONS].find(
            {"_id": {"$in": qids}, "teacher_id": tid}
        )
    )
    if len(question_docs) != len(qids):
        raise ServiceError("All questions must exist and belong to this teacher", 400)

    inferred_subject = _pick_majority(
        [q.get("subject") or "" for q in question_docs], default="__global__"
    )
    inferred_topic = _pick_majority(
        [q.get("topic") or "" for q in question_docs], default="General"
    )
    inferred_difficulty = _pick_majority(
        [q.get("difficulty") or "" for q in question_docs if q.get("difficulty") in ALLOWED_DIFFICULTIES],
        default="medium",
    )

    subject = provided_subject or inferred_subject
    topic = provided_topic or inferred_topic
    difficulty = provided_difficulty or inferred_difficulty

    if provided_subject:
        if any(str(q.get("subject") or "").strip() != subject for q in question_docs):
            raise ServiceError("All selected questions must match quiz `subject`", 400)
    if provided_topic:
        if any(str(q.get("topic") or "").strip() != topic for q in question_docs):
            raise ServiceError("All selected questions must match quiz `topic`", 400)
    if provided_difficulty:
        if any(str(q.get("difficulty") or "").strip().lower() != difficulty for q in question_docs):
            raise ServiceError("All selected questions must match quiz `difficulty`", 400)

    dup = db[COLLECTION_QUIZZES].count_documents(
        {"teacher_id": tid, "topic": topic, "difficulty": difficulty}
    )
    if dup > 0:
        raise ServiceError(
            "Quiz for this topic and difficulty already exists", 400
        )

    doc = {
        "title": title,
        "teacher_id": tid,
        "subject": subject,
        "topic": topic,
        "difficulty": difficulty,
        "question_ids": qids,
        "created_at": datetime.now(timezone.utc),
    }
    res = db[COLLECTION_QUIZZES].insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc) or {}


def assign_quiz(teacher_id: str, payload: dict) -> dict:
    quiz_id = require_oid(str(payload.get("quiz_id", "")), "quiz_id")
    target_type = (payload.get("target_type") or "").strip().lower()
    tid = require_oid(teacher_id, "teacher_id")

    db = get_db()
    quiz = db[COLLECTION_QUIZZES].find_one({"_id": quiz_id, "teacher_id": tid})
    if not quiz:
        raise ServiceError("Quiz not found", 404)

    if target_type not in ("department", "students"):
        raise ServiceError('target_type must be "department" or "students"', 400)

    department = ""
    student_ids: list[ObjectId] = []
    if target_type == "department":
        department = (payload.get("department") or "").strip()
        if not department:
            raise ServiceError("department is required for department assignment", 400)
    else:
        raw = payload.get("student_ids")
        if not isinstance(raw, list) or not raw:
            raise ServiceError("student_ids is required for students assignment", 400)
        for sid in raw:
            student_ids.append(require_oid(str(sid), "student_id"))
        for oid in student_ids:
            u = db[COLLECTION_USERS].find_one({"_id": oid, "role": "student"})
            if not u:
                raise ServiceError(f"Invalid student id: {oid}", 400)

    due_raw = payload.get("due_at")
    due_at = None
    if due_raw:
        if isinstance(due_raw, str):
            try:
                due_at = datetime.fromisoformat(due_raw.replace("Z", "+00:00"))
            except ValueError as exc:
                raise ServiceError("due_at must be ISO-8601 datetime", 400) from exc
        else:
            raise ServiceError("due_at must be an ISO-8601 string", 400)

    doc = {
        "quiz_id": quiz_id,
        "teacher_id": tid,
        "target_type": target_type,
        "department": department,
        "student_ids": student_ids,
        "due_at": due_at,
        "created_at": datetime.now(timezone.utc),
    }
    res = db[COLLECTION_QUIZ_ASSIGNMENTS].insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc) or {}


def _student_may_take(assignment: dict, student: dict | None) -> bool:
    if not student:
        return False
    if assignment.get("target_type") == "department":
        return (student.get("department") or "") == (assignment.get("department") or "")
    sids = assignment.get("student_ids") or []
    return student["_id"] in sids


def list_quizzes(teacher_id: str) -> list[dict]:
    tid = require_oid(teacher_id, "teacher_id")
    db = get_db()
    quizzes = list(db[COLLECTION_QUIZZES].find({"teacher_id": tid}).sort("created_at", -1))

    missing = [q for q in quizzes if not q.get("subject") or not q.get("topic") or not q.get("difficulty")]
    if missing:
        all_qids = set()
        for q in missing:
            for oid in q.get("question_ids") or []:
                all_qids.add(oid)
        if all_qids:
            qdocs = list(db[COLLECTION_QUESTIONS].find({"_id": {"$in": list(all_qids)}}))
            questions_by_id = {q["_id"]: q for q in qdocs}
            for q in missing:
                _ensure_quiz_meta_from_questions(q, questions_by_id)

    return serialize_docs(quizzes)


def list_assignments_for_student(student_id: str) -> dict[str, object]:
    sid = require_oid(student_id, "student_id")
    db = get_db()
    student = db[COLLECTION_USERS].find_one({"_id": sid, "role": "student"})
    if not student:
        raise ServiceError("Student not found", 403)

    dept = student.get("department") or ""
    filt = {
        "$or": [
            {"target_type": "department", "department": dept},
            {"target_type": "students", "student_ids": sid},
        ]
    }
    assign_docs = list(db[COLLECTION_QUIZ_ASSIGNMENTS].find(filt).sort("created_at", -1))
    out: list[dict] = []

    quiz_ids = [a.get("quiz_id") for a in assign_docs if a.get("quiz_id")]
    quizzes = list(db[COLLECTION_QUIZZES].find({"_id": {"$in": quiz_ids}}))
    quizzes_by_id = {q["_id"]: q for q in quizzes}

    missing = [q for q in quizzes if not q.get("subject") or not q.get("topic") or not q.get("difficulty")]
    if missing:
        all_qids = set()
        for q in missing:
            for oid in q.get("question_ids") or []:
                all_qids.add(oid)
        if all_qids:
            qdocs = list(db[COLLECTION_QUESTIONS].find({"_id": {"$in": list(all_qids)}}))
            questions_by_id = {q["_id"]: q for q in qdocs}
            for q in missing:
                _ensure_quiz_meta_from_questions(q, questions_by_id)

    topics = sorted({(q.get("topic") or "").strip() for q in quizzes if q.get("topic")})
    completed_by_topic: dict[str, dict[str, bool]] = {
        t: {"easy": False, "medium": False, "hard": False} for t in topics if t
    }
    if topics:
        relevant_quizzes = list(
            db[COLLECTION_QUIZZES].find(
                {"topic": {"$in": topics}},
                {"_id": 1, "topic": 1, "difficulty": 1, "question_ids": 1},
            )
        )

        quizzes_missing_diff = [
            q
            for q in relevant_quizzes
            if not q.get("difficulty") or q.get("difficulty") not in ALLOWED_DIFFICULTIES
        ]
        if quizzes_missing_diff:
            all_qids = set()
            for q in quizzes_missing_diff:
                for oid in q.get("question_ids") or []:
                    all_qids.add(oid)
            if all_qids:
                qdocs = list(db[COLLECTION_QUESTIONS].find({"_id": {"$in": list(all_qids)}}))
                questions_by_id = {q["_id"]: q for q in qdocs}
                for q in quizzes_missing_diff:
                    # Only infer difficulty here; topic/subject are already present.
                    referenced = [questions_by_id.get(oid) for oid in q.get("question_ids") or []]
                    diffs = [rq.get("difficulty") or "" for rq in referenced if rq]
                    q["difficulty"] = _pick_majority(
                        [d for d in diffs if d in ALLOWED_DIFFICULTIES],
                        default="medium",
                    )

        quiz_id_to_topic_and_diff = {}
        relevant_quiz_ids = []
        for q in relevant_quizzes:
            t = (q.get("topic") or "").strip()
            d = q.get("difficulty") or ""
            if t and d in ("easy", "medium", "hard"):
                quiz_id_to_topic_and_diff[q["_id"]] = (t, d)
                relevant_quiz_ids.append(q["_id"])

        if relevant_quiz_ids:
            attempts = list(
                db[COLLECTION_QUIZ_ATTEMPTS].find(
                    {"student_id": sid, "quiz_id": {"$in": relevant_quiz_ids}}
                ).sort("submitted_at", 1)
            )
            for a in attempts:
                meta = quiz_id_to_topic_and_diff.get(a.get("quiz_id"))
                if not meta:
                    continue
                t, d = meta
                if t not in completed_by_topic or d not in ("easy", "medium", "hard"):
                    continue
                max_s = float(a.get("max_score") or 0)
                total_s = float(a.get("total_score") or 0)
                passed = max_s > 0 and (total_s / max_s) >= 0.70
                if passed:
                    completed_by_topic[t][d] = True

    for a in assign_docs:
        q = quizzes_by_id.get(a.get("quiz_id"))
        out.append({"assignment": serialize_doc(a), "quiz": serialize_doc(q) if q else None})

    return {"assignments": out, "completion_by_topic": completed_by_topic}


def list_student_departments(teacher_id: str) -> list[str]:
    require_oid(teacher_id, "teacher_id")
    db = get_db()
    raw = db[COLLECTION_USERS].distinct(
        "department",
        {"role": "student", "department": {"$nin": [None, ""]}},
    )
    out = sorted({str(d).strip() for d in raw if d and str(d).strip()})
    return out


def get_quiz_attempts_for_teacher(teacher_id: str, quiz_id: str) -> list[dict]:
    tid = require_oid(teacher_id, "teacher_id")
    qid = require_oid(quiz_id, "quiz_id")
    db = get_db()

    quiz = db[COLLECTION_QUIZZES].find_one({"_id": qid, "teacher_id": tid})
    if not quiz:
        raise ServiceError("Quiz not found", 404)

    quiz_topic = (quiz.get("topic") or "").strip()
    quiz_difficulty = (quiz.get("difficulty") or "").strip()

    attempts = list(
        db[COLLECTION_QUIZ_ATTEMPTS]
        .find({"quiz_id": qid})
        .sort("submitted_at", 1)
    )

    student_ids = list({a.get("student_id") for a in attempts if a.get("student_id")})
    users = list(db[COLLECTION_USERS].find({"_id": {"$in": student_ids}}))
    users_by_id = {u["_id"]: u for u in users}

    attempt_counter: dict[ObjectId, int] = defaultdict(int)
    out: list[dict] = []

    def _to_local_time_str(dt):
        if dt is None:
            return None
        if isinstance(dt, datetime):
            local_dt = dt.astimezone()
            return local_dt.strftime("%Y-%m-%d %H:%M")
        return str(dt)

    for a in attempts:
        sid = a.get("student_id")
        if not sid:
            continue
        attempt_counter[sid] += 1
        u = users_by_id.get(sid) or {}

        score = float(a.get("total_score") or 0)
        max_score = float(a.get("max_score") or 0)
        score_percent = int(round(100.0 * score / max_score)) if max_score > 0 else 0

        submitted_raw = a.get("submitted_at")
        out.append(
            {
                "student_name": u.get("full_name") or u.get("email") or str(sid),
                "student_id": str(sid),
                "department": u.get("department") or "",
                "attempt": attempt_counter[sid],
                "attempt_number": attempt_counter[sid],
                "score": score,
                "max_score": max_score,
                "score_percent": score_percent,
                "submitted_at": _to_local_time_str(submitted_raw),
                "submitted_at_iso": submitted_raw.isoformat()
                if isinstance(submitted_raw, datetime)
                else None,
                "quiz_topic": quiz_topic,
                "quiz_difficulty": quiz_difficulty,
            }
        )

    return out


def get_quiz_for_attempt(student_id: str, quiz_id: str, assignment_id: str) -> dict:
    sid = require_oid(student_id, "student_id")
    qid = require_oid(quiz_id, "quiz_id")
    aid = require_oid(assignment_id, "assignment_id")
    db = get_db()

    student = db[COLLECTION_USERS].find_one({"_id": sid, "role": "student"})
    if not student:
        raise ServiceError("Student not found", 403)

    assignment = db[COLLECTION_QUIZ_ASSIGNMENTS].find_one({"_id": aid})
    if not assignment or assignment.get("quiz_id") != qid:
        raise ServiceError("Assignment not found", 404)
    if not _student_may_take(assignment, student):
        raise ServiceError("This quiz is not assigned to you", 403)

    quiz = db[COLLECTION_QUIZZES].find_one({"_id": qid})
    if not quiz:
        raise ServiceError("Quiz not found", 404)

    qids_order = list(quiz.get("question_ids") or [])
    raw = get_questions_by_ids(qids_order)
    by_id = {q["_id"]: q for q in raw}
    questions_out: list[dict] = []
    for oid in qids_order:
        q = by_id.get(oid)
        if not q:
            continue
        safe = {k: v for k, v in q.items() if k != "correct_answer"}
        questions_out.append(serialize_doc(safe) or {})

    return {
        "quiz": serialize_doc(quiz),
        "questions": questions_out,
    }
    