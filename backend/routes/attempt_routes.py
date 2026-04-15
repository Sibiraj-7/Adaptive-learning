from flask import Blueprint, g, jsonify, request

from routes.decorators import auth_required
from services.attempt_service import submit_attempt
from services.errors import ServiceError

attempts_bp = Blueprint("attempts", __name__)


@attempts_bp.post("")
@auth_required(roles=("student",))
def post_attempt():
    body = request.get_json(silent=True) or {}
    try:
        result = submit_attempt(g.user_id, body)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(result), 201
