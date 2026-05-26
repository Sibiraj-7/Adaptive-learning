from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from db.connection import get_db
from db.schema import COLLECTION_STUDENT_MASTERY

ALPHA   = 0.3
GAMMA   = 0.8
EPSILON = 0.05

ACTIONS = ["revisit", "practice", "advance"]

ACTION_THRESHOLDS = {
    "revisit":  (0.0,  0.5),
    "practice": (0.5,  0.8),
    "advance":  (0.8,  1.01),
}

COLLECTION_QTABLE = "student_qtable"

ALLOWED_ACTIONS = {

    "beginner": [
        "revisit",
        "practice"
    ],

    "struggling": [
        "revisit",
        "practice"
    ],

    "improving": [
        "practice",
        "advance"
    ],

    "consistent": [
        "practice",
        "advance"
    ],

    "advanced": [
        "advance"
    ],
}


def calculate_mastery(score: float | int, max_score: float | int) -> float:
    try:
        s, m = float(score), float(max_score)
    except (TypeError, ValueError):
        return 0.0
    if m <= 0:
        return 0.0
    return round(max(0.0, min(100.0, (s / m) * 100.0)), 2)


def classify_mastery(
    mastery_pct: float,
    improvement_rate: float = 0
) -> str:

    mastery_pct = float(mastery_pct)

    if mastery_pct < 40:
        return "beginner"

    if mastery_pct < 60:
        return "struggling"

    if mastery_pct < 75:
        return "improving"

    if mastery_pct < 90:
        return "consistent"

    return "advanced"


def _default_qtable() -> dict[str, dict[str, float]]:
    return {
        state: {
            action: 0.0 for action in ACTIONS
        }
        for state in (
            "beginner",
            "struggling",
            "improving",
            "consistent",
            "advanced",
        )
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
        return random.choice(allowed)           # explore within allowed only
    q_row = qtable.get(state, {})
    return max(allowed, key=lambda a: q_row.get(a, 0.0))   # exploit best allowed


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

    return round(
        max(-1.0, min(1.0, reward)),
        4
    )


def _pick_topic_for_action(action: str, topic_mastery: dict[str, float], current_topic: str) -> str:
    lo, hi = ACTION_THRESHOLDS[action]
    candidates = [(t, m) for t, m in topic_mastery.items() if lo <= m < hi]
    if not candidates:
        candidates = list(topic_mastery.items())
    if not candidates:
        return current_topic or "General"
    if action == "revisit":
        return min(candidates, key=lambda x: x[1])[0]
    return max(candidates, key=lambda x: x[1])[0]


def generate_recommendation(
    current_topic: str,
    score: float | int,
    max_score: float | int,
    student_id: Any = None,
    prev_mastery_frac: float | None = None,
) -> dict[str, Any]:

    mastery_pct   = calculate_mastery(score, max_score)
    mastery_level = classify_mastery(mastery_pct)
    mastery_frac  = mastery_pct / 100.0

    topic_mastery: dict[str, float] = {}
    if student_id is not None:
        try:
            db = get_db()
            for doc in db[COLLECTION_STUDENT_MASTERY].find({"student_id": student_id}):
                for topic, val in (doc.get("topic_mastery") or {}).items():
                    try:
                        topic_mastery[topic] = float(val)
                    except (TypeError, ValueError):
                        continue
        except Exception:
            pass

    action   = ALLOWED_ACTIONS.get(mastery_level, ACTIONS)[0]
    q_values = {a: 0.0 for a in ACTIONS}

    if student_id is not None:
        try:
            db     = get_db()
            qtable = _load_qtable(db, student_id)
            reward = _compute_reward(
                prev_mastery_frac,
                mastery_frac,
                difficulty="medium",
                completed=True,
            )
            prev_state = (
                classify_mastery((prev_mastery_frac or 0.0) * 100.0)
                if prev_mastery_frac is not None else mastery_level
            )
            action = _choose_action(qtable, mastery_level)
            qtable = _update_qtable(qtable, prev_state, action, reward, mastery_level)
            _save_qtable(db, student_id, qtable)
            q_values = qtable.get(mastery_level, q_values)
        except Exception:
            pass

    recommended_topic = _pick_topic_for_action(action, topic_mastery, current_topic)

    return {
        "mastery_percentage":     mastery_pct,
        "mastery_level":          mastery_level,
        "recommended_next_topic": recommended_topic,
        "action_taken":           action,
        "q_values":               q_values,
    }
