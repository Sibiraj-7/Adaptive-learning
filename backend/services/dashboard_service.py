import re
from collections import defaultdict
from math import isfinite

from db.connection import get_db
from db.schema import (
    COLLECTION_LEARNING_MATERIALS,
    COLLECTION_QUIZ_ATTEMPTS,
    COLLECTION_QUIZ_ASSIGNMENTS,
    COLLECTION_QUIZZES,
    COLLECTION_STUDENT_MASTERY,
    COLLECTION_USERS,
)
from services.serialization import require_oid, serialize_doc, serialize_docs


def _split_mastery_key(k: str) -> tuple[str, str]:
    if not k or not isinstance(k, str):
        return ("", k)
    if "::" in k:
        parts = k.split("::", 1)
        return (parts[0], parts[1])
    if ":" in k:
        parts = k.split(":", 1)
        return (parts[0], parts[1])
    return ("", k)


def _split_subject_topic(label: str) -> tuple[str, str]:
    return _split_mastery_key(label)


def get_topic_mastery_distribution(difficult_rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for r in difficult_rows or []:
        out.append({
            "subject":    r.get("subject") or "",
            "topic":      r.get("topic") or r.get("topic_name") or "",
            "difficulty": r.get("difficulty") or "",
            "accuracy":   r.get("avg_accuracy"),
        })
    return out


def get_class_insights(
    db,
    student_ids: set,
    difficult_rows: list[dict],
    topic_accuracy_by_key: dict[str, float] | None = None,
) -> dict:
    students_attempted = len(student_ids)
    if students_attempted == 0:
        return {
            "students_attempted":   0,
            "topics_completed":     0,
            "average_mastery":      None,
            "most_difficult_topic": None,
        }

    if topic_accuracy_by_key:
        topic_keys = sorted(topic_accuracy_by_key.keys())
        most_difficult_topic = (
            min(topic_accuracy_by_key.items(), key=lambda x: x[1])[0]
            if topic_accuracy_by_key else None
        )
    else:
        topic_keys = sorted({r.get("topic_key") for r in difficult_rows if r.get("topic_key")})
        acc_by_topic: defaultdict[str, list[float]] = defaultdict(list)
        for r in difficult_rows or []:
            key = r.get("topic_key")
            if not key:
                continue
            acc = r.get("avg_accuracy")
            if acc is None:
                continue
            acc_by_topic[str(key)].append(float(acc))
        per_topic_acc = {k: sum(v) / len(v) for k, v in acc_by_topic.items() if v}
        most_difficult_topic = (
            min(per_topic_acc.items(), key=lambda x: x[1])[0] if per_topic_acc else None
        )

    mastery_map: dict[tuple, float] = {}
    mastery_docs = list(
        db[COLLECTION_STUDENT_MASTERY].find({"student_id": {"$in": list(student_ids)}})
    )
    for doc in mastery_docs:
        sid = doc.get("student_id")
        subj = (doc.get("subject") or "").strip()
        for topic, val in (doc.get("topic_mastery") or {}).items():
            if not isinstance(val, (int, float)):
                continue
            topic_key = f"{subj}::{topic}" if subj else str(topic)
            mastery_map[(sid, topic_key)] = float(val)

    topic_avgs: list[float] = []
    topics_completed = 0
    for tk in topic_keys:
        avg = sum(mastery_map.get((sid, tk), 0.0) for sid in student_ids) / students_attempted
        topic_avgs.append(avg)
        if avg >= 0.8:
            topics_completed += 1

    average_mastery = sum(topic_avgs) / len(topic_avgs) if topic_avgs else None

    return {
        "students_attempted":   students_attempted,
        "topics_completed":     topics_completed,
        "average_mastery":      average_mastery,
        "most_difficult_topic": most_difficult_topic,
    }


def student_dashboard(student_id: str) -> dict:
    sid = require_oid(student_id, "student_id")
    db = get_db()

    attempts = list(
        db[COLLECTION_QUIZ_ATTEMPTS]
        .find({"student_id": sid})
        .sort("submitted_at", -1)
        .limit(25)
    )

    mastery_docs = list(db[COLLECTION_STUDENT_MASTERY].find({"student_id": sid}))
    merged_mastery: dict[str, float] = {}
    mastery_by_subject: dict[str, dict] = {}
    for d in mastery_docs:
        subj = d.get("subject") or ""
        mastery_by_subject[subj] = serialize_doc(d) or {}
        for topic, val in (d.get("topic_mastery") or {}).items():
            key = f"{subj}:{topic}" if subj else topic
            try:
                merged_mastery[key] = float(val)
            except (TypeError, ValueError):
                continue

    weak_only = {
        k: v for k, v in merged_mastery.items()
        if isinstance(v, (int, float)) and v < 0.5
    }
    weak_sorted = sorted(weak_only.items(), key=lambda x: (x[1], x[0]))
    weak_topics = []
    for k, v in weak_sorted[:15]:
        subj, topic = _split_mastery_key(k)
        weak_topics.append({"key": k, "subject": subj, "topic": topic, "mastery": v})

    recommended: str | None = None
    all_quizzes_completed = False

    if attempts:
        latest = attempts[0]
        rec_raw = latest.get("recommended_next_topic")
        if rec_raw is not None:
            recommended = str(rec_raw).strip() or None
        else:
            if "recommended_next_topic" in latest:
                all_quizzes_completed = True

    if not recommended and not all_quizzes_completed and weak_topics:
        recommended = weak_topics[0]["key"].split(":")[-1]

    mats = []
    if recommended:
        mats = list(
            db[COLLECTION_LEARNING_MATERIALS]
            .find({
                "topic": {
                    "$regex": f"^{re.escape(recommended)}$",
                    "$options": "i",
                }
            })
            .limit(15)
        )
        if not mats and weak_topics:
            alt = weak_topics[0]["key"].split(":")[-1]
            mats = list(
                db[COLLECTION_LEARNING_MATERIALS]
                .find({"topic": {"$regex": f"^{re.escape(alt)}$", "$options": "i"}})
                .limit(15)
            )

    return {
        "recent_attempts":        serialize_docs(attempts),
        "mastery_by_subject":     mastery_by_subject,
        "weak_topics":            weak_topics,
        "recommended_next_topic": recommended,
        "all_quizzes_completed":  all_quizzes_completed,
        "suggested_materials":    serialize_docs(mats),
    }


def teacher_dashboard(teacher_id: str) -> dict:
    tid = require_oid(teacher_id, "teacher_id")
    db = get_db()

    quizzes = list(db[COLLECTION_QUIZZES].find({"teacher_id": tid}))
    quiz_by_id = {q["_id"]: q for q in quizzes}
    qids = list(quiz_by_id.keys())
    if not qids:
        return {
            "average_score_percent":     None,
            "unique_students_attempted": 0,
            "total_attempts":            0,
            "quizzes":                   serialize_docs(quizzes),
            "quiz_summaries":            [],
            "most_difficult_topics":     [],
        }

    attempts = list(db[COLLECTION_QUIZ_ATTEMPTS].find({"quiz_id": {"$in": qids}}))
    unique_students_attempted = len(
        {a.get("student_id") for a in attempts if a.get("student_id")}
    )

    best_pct_by_student: dict[object, float] = {}
    for a in attempts:
        sid = a.get("student_id")
        if sid is None:
            continue
        mx = float(a.get("max_score") or 0)
        if mx <= 0:
            continue
        pct = float(a.get("total_score") or 0) / mx
        if not isfinite(pct):
            continue
        if pct > best_pct_by_student.get(sid, -1):
            best_pct_by_student[sid] = pct

    best_pct_values = list(best_pct_by_student.values())
    average_score_percent = (
        round(100.0 * sum(best_pct_values) / len(best_pct_values), 2)
        if best_pct_values else None
    )

    best_accuracy: dict[tuple, float] = {}
    for a in attempts:
        quiz_meta = quiz_by_id.get(a.get("quiz_id")) or {}
        difficulty = (quiz_meta.get("difficulty") or "").strip().lower()
        if difficulty not in ("easy", "medium", "hard"):
            continue
        sid = a.get("student_id")
        if sid is None:
            continue
        for label, row in (a.get("topic_performance") or {}).items():
            if not isinstance(row, dict):
                continue
            tot = float(row.get("total") or 0)
            if tot <= 0:
                continue
            acc = float(row.get("correct") or 0) / tot
            if not isfinite(acc):
                continue
            key = (sid, str(label), difficulty)
            if acc > best_accuracy.get(key, -1):
                best_accuracy[key] = acc

    per_label_diff: defaultdict[tuple[str, str], list[float]] = defaultdict(list)
    for (sid, label, difficulty), acc in best_accuracy.items():
        per_label_diff[(label, difficulty)].append(acc)

    difficult: list[dict] = []
    for (label, difficulty), accs in per_label_diff.items():
        avg_acc = sum(accs) / len(accs)
        subj, topic_name = _split_subject_topic(label)
        difficult.append({
            "topic_key":    label,
            "subject":      subj,
            "topic":        topic_name,
            "difficulty":   difficulty,
            "avg_accuracy": round(avg_acc, 4),
        })
    difficult.sort(key=lambda x: (x["avg_accuracy"], x["topic_key"], x.get("difficulty") or ""))

    correct_by_label: defaultdict[str, float] = defaultdict(float)
    total_by_label: defaultdict[str, float] = defaultdict(float)
    for a in attempts:
        for label, row in (a.get("topic_performance") or {}).items():
            if not isinstance(row, dict):
                continue
            tot = float(row.get("total") or 0)
            if tot <= 0:
                continue
            correct_by_label[str(label)] += float(row.get("correct") or 0)
            total_by_label[str(label)] += tot

    topic_accuracy_rows: list[dict] = []
    for label in correct_by_label:
        tden = total_by_label[label]
        if tden <= 0:
            continue
        acc = correct_by_label[label] / tden
        subj, topic_name = _split_subject_topic(label)
        topic_accuracy_rows.append({
            "topic_key":    label,
            "subject":      subj,
            "topic":        topic_name,
            "difficulty":   "",
            "avg_accuracy": round(acc, 4),
        })
    topic_accuracy_rows.sort(key=lambda x: (x["avg_accuracy"], x["topic_key"]))

    attempts_by_quiz: defaultdict[object, list[dict]] = defaultdict(list)
    for a in attempts:
        qid = a.get("quiz_id")
        if qid is not None:
            attempts_by_quiz[qid].append(a)

    quiz_summaries: list[dict] = []
    for q in quizzes:
        qid = q["_id"]
        sub = attempts_by_quiz.get(qid, [])
        best: dict[object, float] = {}
        for a in sub:
            s = a.get("student_id")
            if s is None:
                continue
            mx = float(a.get("max_score") or 0)
            if mx <= 0:
                continue
            pct = float(a.get("total_score") or 0) / mx
            if not isfinite(pct):
                continue
            if pct > best.get(s, -1):
                best[s] = pct
        best_pcts = list(best.values())
        quiz_summaries.append({
            "quiz":            serialize_doc(q),
            "attempt_count":   len(best),
            "average_percent": round(100.0 * sum(best_pcts) / len(best_pcts), 2) if best_pcts else None,
        })

    student_ids = {a.get("student_id") for a in attempts if a.get("student_id") is not None}
    topic_acc_map = {r["topic_key"]: float(r["avg_accuracy"]) for r in topic_accuracy_rows}
    class_insights = get_class_insights(
        db,
        student_ids=student_ids,
        difficult_rows=difficult,
        topic_accuracy_by_key=topic_acc_map or None,
    )

    return {
        "average_score_percent":      average_score_percent,
        "unique_students_attempted":  unique_students_attempted,
        "total_attempts":             len(attempts),
        "quizzes":                    serialize_docs(quizzes),
        "quiz_summaries":             quiz_summaries,
        "most_difficult_topics":      topic_accuracy_rows[:15],
        "topic_mastery_distribution": get_topic_mastery_distribution(difficult),
        "class_insights":             class_insights,
    }


def get_student_progress(teacher_id_str: str) -> list[dict]:
    tid = require_oid(teacher_id_str, "teacher_id")
    db = get_db()

    quizzes = list(db[COLLECTION_QUIZZES].find({"teacher_id": tid}, {"_id": 1}))
    qids = [q["_id"] for q in quizzes]
    if not qids:
        return []

    attempts = list(
        db[COLLECTION_QUIZ_ATTEMPTS]
        .find({"quiz_id": {"$in": qids}})
        .sort("submitted_at", 1)
    )
    student_ids = list({a["student_id"] for a in attempts if a.get("student_id")})
    if not student_ids:
        return []

    users = list(db[COLLECTION_USERS].find({"_id": {"$in": student_ids}}, {"password_hash": 0}))
    users_by_id = {u["_id"]: u for u in users}

    mastery_docs = list(db[COLLECTION_STUDENT_MASTERY].find({"student_id": {"$in": student_ids}}))
    mastery_by_sid: dict = {}
    for doc in mastery_docs:
        sid = doc.get("student_id")
        if not sid:
            continue
        tm = doc.get("topic_mastery") or {}
        mastery_by_sid.setdefault(sid, {}).update(
            {t: float(v) for t, v in tm.items() if isinstance(v, (int, float))}
        )

    attempts_by_sid: dict = {}
    for a in attempts:
        sid = a.get("student_id")
        if sid:
            attempts_by_sid.setdefault(sid, []).append(a)

    def classify(pct: float) -> str:
        if pct < 40:  return "beginner"
        if pct < 60:  return "struggling"
        if pct < 75:  return "improving"
        if pct < 90:  return "consistent"
        return "advanced"

    out = []
    for sid in student_ids:
        user = users_by_id.get(sid) or {}
        sid_attempts = attempts_by_sid.get(sid, [])
        tm = mastery_by_sid.get(sid, {})

        avg_mastery = round(sum(tm.values()) / len(tm) * 100, 1) if tm else 0.0
        best_topic = max(tm.items(), key=lambda x: x[1])[0] if tm else "—"

        trend = "—"
        if len(sid_attempts) >= 2:
            def pct_of(a):
                mx = float(a.get("max_score") or 0)
                return (float(a.get("total_score") or 0) / mx * 100) if mx else 0.0
            delta = pct_of(sid_attempts[-1]) - pct_of(sid_attempts[-2])
            if delta >= 20:    trend = "↑↑"
            elif delta >= 5:   trend = "↑"
            elif delta >= -5:  trend = "→"
            elif delta >= -20: trend = "↓"
            else:              trend = "↓↓"

        out.append({
            "student_id":     str(sid),
            "full_name":      user.get("full_name") or user.get("email") or str(sid),
            "department":     user.get("department") or "—",
            "mastery_state":  classify(avg_mastery),
            "avg_mastery":    avg_mastery,
            "best_topic":     best_topic,
            "total_attempts": len(sid_attempts),
            "trend":          trend,
        })

    out.sort(key=lambda x: x["avg_mastery"], reverse=True)
    return out