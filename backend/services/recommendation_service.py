from __future__ import annotations

import random
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

ALPHA   = 0.3
GAMMA   = 0.8
EPSILON = 0.05

ACTIONS = ["revisit", "practice", "advance"]

ACTION_THRESHOLDS: dict[str, tuple[float, float]] = {
    "revisit":  (0.0,  0.5),
    "practice": (0.5,  0.8),
    "advance":  (0.8,  1.01),
}

COLLECTION_QTABLE = "student_qtable"

ALLOWED_ACTIONS: dict[str, list[str]] = {
    "beginner":   ["revisit", "practice"],
    "struggling": ["revisit", "practice"],
    "improving":  ["practice", "advance"],
    "consistent": ["practice", "advance"],
    "advanced":   ["advance"],
}


def calculate_mastery(score: float | int, max_score: float | int) -> float:
    try:
        s, m = float(score), float(max_score)
    except (TypeError, ValueError):
        return 0.0
    if m <= 0:
        return 0.0
    return round(max(0.0, min(100.0, (s / m) * 100.0)), 2)


def classify_mastery(mastery_pct: float) -> str:
    pct = float(mastery_pct)
    if pct < 40:
        return "beginner"
    if pct < 60:
        return "struggling"
    if pct < 75:
        return "improving"
    if pct < 90:
        return "consistent"
    return "advanced"


def _default_qtable() -> dict[str, dict[str, float]]:
    return {
        state: {action: 0.0 for action in ACTIONS}
        for state in ALLOWED_ACTIONS
    }


def _load_qtable(db, student_id: ObjectId) -> dict[str, dict[str, float]]:
    doc = db[COLLECTION_QTABLE].find_one({"student_id": student_id})
    if doc and isinstance(doc.get("qtable"), dict):
        return doc["qtable"]
    return _default_qtable()


def _save_qtable(db, student_id: ObjectId, qtable: dict) -> None:
    db[COLLECTION_QTABLE].update_one(
        {"student_id": student_id},
        {
            "$set": {"qtable": qtable, "updated_at": datetime.now(timezone.utc)},
            "$setOnInsert": {"student_id": student_id},
        },
        upsert=True,
    )


def _choose_action(qtable: dict, state: str) -> str:
    allowed = ALLOWED_ACTIONS.get(state, ACTIONS)
    if random.random() < EPSILON:
        return random.choice(allowed)
    q_row = qtable.get(state, {})
    return max(allowed, key=lambda a: q_row.get(a, 0.0))


def _update_qtable(qtable, state, action, reward, next_state) -> dict:
    q_row      = qtable.setdefault(state, {a: 0.0 for a in ACTIONS})
    q_next_row = qtable.get(next_state, {a: 0.0 for a in ACTIONS})
    current_q  = q_row.get(action, 0.0)
    max_next_q = max(q_next_row.values()) if q_next_row else 0.0
    q_row[action] = round(
        current_q + ALPHA * (reward + GAMMA * max_next_q - current_q), 6
    )
    qtable[state] = q_row
    return qtable


def _compute_reward(
    prev_mastery_frac: float | None,
    new_mastery_frac: float,
    difficulty: str = "medium",
    completed: bool = True,
) -> float:

    if prev_mastery_frac is None:
        return 0.2

    improvement = new_mastery_frac - prev_mastery_frac

    difficulty_bonus = {
        "easy": 0.05,
        "medium": 0.10,
        "hard": 0.20,
    }.get(difficulty, 0.1)

    completion_bonus = 0.1 if completed else -0.1

    consistency_bonus = 0.1 if improvement > 0 else -0.05

    reward = (
        improvement * 0.6 +
        difficulty_bonus +
        completion_bonus +
        consistency_bonus
    )

    return round(max(-1.0, min(1.0, reward)), 4)


def _get_assigned_quiz_topics(db, student_id: ObjectId) -> list[dict]:
    student = db[COLLECTION_USERS].find_one({"_id": student_id})
    dept = (student.get("department") or "").strip() if student else ""
    dept_upper = dept.upper()

    assignments = list(db[COLLECTION_QUIZ_ASSIGNMENTS].find({
        "$or": [
            {"target_type": "department", "department": dept_upper},
            {"target_type": "department", "department": dept},
            {"target_type": "students",   "student_ids": student_id},
        ]
    }))

    if not assignments:
        return []

    quiz_ids = list({a["quiz_id"] for a in assignments if a.get("quiz_id")})
    if not quiz_ids:
        return []

    quizzes = list(db[COLLECTION_QUIZZES].find({"_id": {"$in": quiz_ids}}))

    attempted_quiz_ids: set[ObjectId] = {
        a["quiz_id"]
        for a in db[COLLECTION_QUIZ_ATTEMPTS].find(
            {"student_id": student_id, "quiz_id": {"$in": quiz_ids}},
            {"quiz_id": 1},
        )
        if a.get("quiz_id")
    }

    difficulty_order = {"easy": 0, "medium": 1, "hard": 2}

    rows: list[dict] = []
    for q in quizzes:
        topic = (q.get("topic") or "").strip()
        subject = (q.get("subject") or "").strip()
        difficulty = (q.get("difficulty") or "medium").strip().lower()
        if not topic:
            continue
        rows.append({
            "quiz_id":     q["_id"],
            "topic":       topic,
            "subject":     subject,
            "difficulty":  difficulty,
            "attempted":   q["_id"] in attempted_quiz_ids,
            "_diff_order": difficulty_order.get(difficulty, 1),
        })

    rows.sort(key=lambda r: (r["attempted"], r["_diff_order"], r["topic"]))
    return rows


def _pick_next_topic(
    action: str,
    assigned_rows: list[dict],
    topic_mastery: dict[str, float],
    current_topic: str,
) -> str | None:
    unattempted = [r for r in assigned_rows if not r["attempted"]]

    if not unattempted:
        return None

    lo, hi = ACTION_THRESHOLDS[action]

    def mastery_of(row: dict) -> float:
        return topic_mastery.get(row["topic"], 0.0)

    candidates = [r for r in unattempted if lo <= mastery_of(r) < hi]

    if not candidates:
        candidates = unattempted

    if action == "revisit":
        return min(candidates, key=lambda r: (mastery_of(r), r["_diff_order"], r["topic"]))["topic"]

    if action == "practice":
        return max(candidates, key=lambda r: (mastery_of(r), -r["_diff_order"]))["topic"]

    not_started = [r for r in candidates if mastery_of(r) == 0.0]
    pool = not_started if not_started else candidates
    return min(pool, key=lambda r: (r["_diff_order"], r["topic"]))["topic"]


def generate_recommendation(
    current_topic: str,
    score: float | int,
    max_score: float | int,
    student_id: Any = None,
    prev_mastery_frac: float | None = None,
    quiz_difficulty: str = "medium",
) -> dict[str, Any]:

    mastery_pct   = calculate_mastery(score, max_score)
    mastery_level = classify_mastery(mastery_pct)
    mastery_frac  = mastery_pct / 100.0

    action    = ALLOWED_ACTIONS.get(mastery_level, ACTIONS)[0]
    q_values  = {a: 0.0 for a in ACTIONS}
    recommended_topic: str | None = current_topic
    all_done  = False

    if student_id is not None:
        try:
            sid = student_id if isinstance(student_id, ObjectId) else ObjectId(str(student_id))
            db  = get_db()

            topic_mastery: dict[str, float] = {}
            for doc in db[COLLECTION_STUDENT_MASTERY].find({"student_id": sid}):
                for topic, val in (doc.get("topic_mastery") or {}).items():
                    try:
                        topic_mastery[topic] = float(val)
                    except (TypeError, ValueError):
                        continue

            topic_mastery[current_topic] = mastery_frac

            qtable = _load_qtable(db, sid)
            reward = _compute_reward(
                prev_mastery_frac,
                mastery_frac,
                difficulty=quiz_difficulty,
                completed=True,
            )
            prev_state = (
                classify_mastery((prev_mastery_frac or 0.0) * 100.0)
                if prev_mastery_frac is not None else mastery_level
            )
            action = _choose_action(qtable, mastery_level)
            qtable = _update_qtable(qtable, prev_state, action, reward, mastery_level)
            _save_qtable(db, sid, qtable)
            q_values = qtable.get(mastery_level, q_values)

            assigned_rows = _get_assigned_quiz_topics(db, sid)
            recommended_topic = _pick_next_topic(action, assigned_rows, topic_mastery, current_topic)
            all_done = recommended_topic is None

        except Exception:
            pass

    return {
        "mastery_percentage":     mastery_pct,
        "mastery_level":          mastery_level,
        "recommended_next_topic": recommended_topic,
        "all_quizzes_completed":  all_done,
        "action_taken":           action,
        "q_values":               q_values,
    }
