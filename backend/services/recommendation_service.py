from typing import Any

def calculate_mastery(score: float | int, max_score: float | int) -> float:
    try:
        s = float(score)
        m = float(max_score)
    except (TypeError, ValueError):
        return 0.0

    if m <= 0:
        return 0.0

    pct = (s / m) * 100.0
    pct = max(0.0, min(100.0, pct))
    return round(pct, 2)


def classify_mastery(mastery: float | int) -> str:
    try:
        value = float(mastery)
    except (TypeError, ValueError):
        value = 0.0

    if value >= 80.0:
        return "high"
    if value >= 50.0:
        return "medium"
    return "low"


def recommend_next_topic(current_topic: str, mastery_level: str) -> str:
    topic = (current_topic or "").strip() or "general"
    if mastery_level == "high":
        return f"advanced_{topic}"
    if mastery_level == "medium":
        return f"practice_{topic}"
    return f"basic_{topic}"


def generate_recommendation(
    current_topic: str,
    score: float | int,
    max_score: float | int,
) -> dict[str, Any]:
    mastery_percentage = calculate_mastery(score, max_score)
    mastery_level = classify_mastery(mastery_percentage)
    recommended_next_topic = recommend_next_topic(current_topic, mastery_level)
    return {
        "mastery_percentage": mastery_percentage,
        "mastery_level": mastery_level,
        "recommended_next_topic": recommended_next_topic,
    }
