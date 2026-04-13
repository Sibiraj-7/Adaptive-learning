from flask import Blueprint, jsonify, request

from services.auth_service import login
from services.errors import ServiceError

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def post_login():
    body = request.get_json(silent=True) or {}

    try:
        result = login(
            body.get("email", "").strip(),
            body.get("password", "")
        )
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status

    return jsonify(result), 200