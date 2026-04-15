from flask import Blueprint, jsonify

from db.connection import get_db

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    try:
        get_db().command("ping")
        mongo_ok = True
    except Exception:
        mongo_ok = False
    return jsonify({"status": "ok" if mongo_ok else "degraded", "mongodb": mongo_ok})
