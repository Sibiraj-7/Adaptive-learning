from functools import wraps
from typing import Callable, Iterable

from flask import g, jsonify, request

from services.auth_service import verify_token
from services.errors import ServiceError


def auth_required(roles: Iterable[str] | None = None) -> Callable:
    allowed = set(roles) if roles is not None else None

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapped(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return jsonify({"error": "Missing or invalid Authorization header"}), 401
            token = header[7:].strip()
            try:
                data = verify_token(token)
            except ServiceError as exc:
                return jsonify({"error": exc.message}), exc.status
            if allowed is not None and data["role"] not in allowed:
                return jsonify({"error": "Forbidden"}), 403
            g.user_id = data["uid"]
            g.role = data["role"]
            return f(*args, **kwargs)

        return wrapped

    return decorator
