from collections import defaultdict
from math import isfinite

from db.connection import get_db
from db.schema import (
    COLLECTION_LEARNING_MATERIALS,
    COLLECTION_QUIZ_ATTEMPTS,
    COLLECTION_QUIZZES,
    COLLECTION_STUDENT_MASTERY,
)
from services.serialization import require_oid, serialize_doc, serialize_docs


def get_topic_mastery_distribution(difficult_rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for r in difficult_rows or []:
        out.append(
            {
                "subject": r.get("subject") or "",
                "topic": r.get("topic") or r.get("topic_name") or "",
                "difficulty": r.get("difficulty") or "",
                "accuracy": r.get("avg_accuracy"),
            }
        )
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
            "students_attempted": 0,
            "topics_completed": 0,
            "average_mastery": None,
            "most_difficult_topic": None,
        }

    if topic_accuracy_by_key:
        topic_keys = sorted(topic_accuracy_by_key.keys())
        most_difficult_topic = (
            min(topic_accuracy_by_key.items(), key=lambda x: x[1])[0]
            if topic_accuracy_by_key
            else None
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

        per_topic_acc: dict[str, float] = {}
        for k in topic_keys:
            vals = acc_by_topic.get(k, [])
            if not vals:
                continue
            per_topic_acc[k] = sum(vals) / len(vals)

        most_difficult_topic = None
        if per_topic_acc:
            most_difficult_topic = min(per_topic_acc.items(), key=lambda x: x[1])[0]

    mastery_map: dict[tuple[object, str], float] = {}
    mastery_docs = list(
        db[COLLECTION_STUDENT_MASTERY].find(
            {"student_id": {"$in": list(student_ids)}}
        )
    )
    for doc in mastery_docs:
        sid = doc.get("student_id")
        subj = (doc.get("subject") or "").strip()
        topic_mastery = doc.get("topic_mastery") or {}
        if sid is None or not isinstance(topic_mastery, dict):
            continue
        for topic, val in topic_mastery.items():
            if not isinstance(val, (int, float)):
                continue
            topic_key = f"{subj}::{topic}" if subj else str(topic)
            mastery_map[(sid, str(topic_key))] = float(val)

    topic_avgs: list[float] = []
    topics_completed = 0
    for topic_key in topic_keys:
        avg = sum(
            mastery_map.get((sid, topic_key), 0.0) for sid in student_ids
        ) / students_attempted
        topic_avgs.append(avg)
        if avg >= 0.8:
            topics_completed += 1

    average_mastery = (
        (sum(topic_avgs) / len(topic_avgs)) if topic_avgs else None
    )

    return {
        "students_attempted": students_attempted,
        "topics_completed": topics_completed,
        "average_mastery": average_mastery,
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

    weak_only = {k: v for k, v in merged_mastery.items() if isinstance(v, (int, float)) and v < 0.5}
    weak_sorted = sorted(weak_only.items(), key=lambda x: (x[1], x[0]))

    def _split_mastery_key(k: str) -> tuple[str, str]:
        # Keys are currently built as "subject:topic" (single colon) or just "topic".
        if not k or not isinstance(k, str):
            return ("", k)
        if "::" in k:
            parts = k.split("::", 1)
            if len(parts) == 2:
                return (parts[0], parts[1])
        if ":" in k:
            parts = k.split(":", 1)
            if len(parts) == 2:
                return (parts[0], parts[1])
        return ("", k)

    weak_topics = []
    for k, v in weak_sorted[:15]:
        subj, topic = _split_mastery_key(k)
        weak_topics.append({"key": k, "subject": subj, "topic": topic, "mastery": v})

    recommended = ""
    if attempts:
        recommended = (attempts[0].get("recommended_next_topic") or "").strip()
    if not recommended and weak_topics:
        recommended = weak_topics[0]["key"].split(":")[-1]

    topic_query = recommended
    mats = []
    if topic_query:
        mats = list(
            db[COLLECTION_LEARNING_MATERIALS]
            .find({"topic": topic_query})
            .limit(15)
        )
    if not mats and weak_topics:
        alt = weak_topics[0]["key"].split(":")[-1]
        mats = list(
            db[COLLECTION_LEARNING_MATERIALS].find({"topic": alt}).limit(15)
        )

    return {
        "recent_attempts": serialize_docs(attempts),
        "mastery_by_subject": mastery_by_subject,
        "weak_topics": weak_topics,
        "recommended_next_topic": recommended,
        "suggested_materials": serialize_docs(mats),
    }


def teacher_dashboard(teacher_id: str) -> dict:
    tid = require_oid(teacher_id, "teacher_id")
    db = get_db()

    quizzes = list(db[COLLECTION_QUIZZES].find({"teacher_id": tid}))
    quiz_by_id = {q["_id"]: q for q in quizzes}
    qids = list(quiz_by_id.keys())
    if not qids:
        return {
            "average_score_percent": None,
            "unique_students_attempted": 0,
            "total_attempts": 0,
            "quizzes": serialize_docs(quizzes),
            "quiz_summaries": [],
            "most_difficult_topics": [],
        }

    attempts = list(db[COLLECTION_QUIZ_ATTEMPTS].find({"quiz_id": {"$in": qids}}))

    unique_students_attempted = len({a.get("student_id") for a in attempts if a.get("student_id")})

    best_percent_by_student: dict[object, float] = {}
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
        prev = best_percent_by_student.get(sid)
        if prev is None or pct > prev:
            best_percent_by_student[sid] = pct

    best_percent_values = list(best_percent_by_student.values())
    average_score_percent = (
        round(100.0 * sum(best_percent_values) / len(best_percent_values), 2)
        if best_percent_values
        else None
    )

    def _split_subject_topic(label: str) -> tuple[str, str]:
        if not label:
            return ("", "")
        parts = str(label).split("::", 1)
        if len(parts) == 2:
            return (parts[0].strip(), parts[1].strip())
        # Fallback for older/single-colon keys.
        if ":" in label:
            left, right = str(label).split(":", 1)
            return (left.strip(), right.strip())
        return ("", str(label).strip())

    best_accuracy: dict[tuple[object, str, str], float] = {}
    for a in attempts:
        quiz_id = a.get("quiz_id")
        quiz_meta = quiz_by_id.get(quiz_id) or {}
        difficulty = (quiz_meta.get("difficulty") or "").strip().lower()
        if difficulty not in ("easy", "medium", "hard"):
            continue

        sid = a.get("student_id")
        if sid is None:
            continue

        tp = a.get("topic_performance") or {}
        if not isinstance(tp, dict):
            continue

        for label, row in tp.items():
            if not isinstance(row, dict):
                continue
            tot = float(row.get("total") or 0)
            if tot <= 0:
                continue
            correct = float(row.get("correct") or 0)
            acc = correct / tot
            if not isfinite(acc):
                continue

            key = (sid, str(label), difficulty)
            prev = best_accuracy.get(key)
            if prev is None or acc > prev:
                best_accuracy[key] = acc

    per_label_diff_students: defaultdict[tuple[str, str], list[float]] = defaultdict(list)
    for (sid, label, difficulty), acc in best_accuracy.items():
        per_label_diff_students[(label, difficulty)].append(acc)

    difficult: list[dict] = []
    for (label, difficulty), accs in per_label_diff_students.items():
        if not accs:
            continue
        avg_acc = sum(accs) / len(accs)
        subj, topic_name = _split_subject_topic(label)
        difficult.append(
            {
                "topic_key": label,
                "subject": subj,
                "topic": topic_name,
                "difficulty": difficulty,
                "avg_accuracy": round(avg_acc, 4),
            }
        )

    difficult.sort(
        key=lambda x: (x["avg_accuracy"], x["topic_key"], x.get("difficulty") or "")
    )

    correct_by_label: defaultdict[str, float] = defaultdict(float)
    total_by_label: defaultdict[str, float] = defaultdict(float)
    for a in attempts:
        tp = a.get("topic_performance") or {}
        if not isinstance(tp, dict):
            continue
        for label, row in tp.items():
            if not isinstance(row, dict):
                continue
            tot = float(row.get("total") or 0)
            if tot <= 0:
                continue
            correct = float(row.get("correct") or 0)
            lk = str(label)
            correct_by_label[lk] += correct
            total_by_label[lk] += tot

    topic_accuracy_rows: list[dict] = []
    for label in correct_by_label:
        tden = total_by_label[label]
        if tden <= 0:
            continue
        acc = correct_by_label[label] / tden
        subj, topic_name = _split_subject_topic(label)
        topic_accuracy_rows.append(
            {
                "topic_key": label,
                "subject": subj,
                "topic": topic_name,
                "difficulty": "",
                "avg_accuracy": round(acc, 4),
            }
        )
    topic_accuracy_rows.sort(key=lambda x: (x["avg_accuracy"], x["topic_key"]))

    quiz_summaries: list[dict] = []
    attempts_by_quiz: dict[object, list[dict]] = defaultdict(list)
    for a in attempts:
        qid = a.get("quiz_id")
        if qid is None:
            continue
        attempts_by_quiz[qid].append(a)

    for q in quizzes:
        qid = q["_id"]
        sub = attempts_by_quiz.get(qid, [])

        # best % per student on this quiz.
        best_pct_by_student: dict[object, float] = {}
        for a in sub:
            sid = a.get("student_id")
            if sid is None:
                continue
            mx = float(a.get("max_score") or 0)
            if mx <= 0:
                continue
            pct = float(a.get("total_score") or 0) / mx
            if not isfinite(pct):
                continue
            prev = best_pct_by_student.get(sid)
            if prev is None or pct > prev:
                best_pct_by_student[sid] = pct

        best_pcts = list(best_pct_by_student.values())
        quiz_summaries.append(
            {
                "quiz": serialize_doc(q),
                "attempt_count": len(best_pct_by_student),  # unique students
                "average_percent": round(100.0 * sum(best_pcts) / len(best_pcts), 2)
                if best_pcts
                else None,
            }
        )

    student_ids = {a.get("student_id") for a in attempts if a.get("student_id") is not None}
    topic_acc_map = {r["topic_key"]: float(r["avg_accuracy"]) for r in topic_accuracy_rows}
    class_insights = get_class_insights(
        db,
        student_ids=student_ids,
        difficult_rows=difficult,
        topic_accuracy_by_key=topic_acc_map if topic_acc_map else None,
    )

    topic_mastery_distribution = get_topic_mastery_distribution(difficult)

    return {
        "average_score_percent": average_score_percent,
        "unique_students_attempted": unique_students_attempted,
        "total_attempts": len(attempts),
        "quizzes": serialize_docs(quizzes),
        "quiz_summaries": quiz_summaries,
        "most_difficult_topics": topic_accuracy_rows[:15],
        "topic_mastery_distribution": topic_mastery_distribution,
        "class_insights": class_insights,
    }
