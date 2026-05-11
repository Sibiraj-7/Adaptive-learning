from flask import Blueprint, jsonify, request

from routes.decorators import auth_required
from services.admin_service import (
    create_user,
    delete_user,
    get_stats,
    list_users,
    reset_password,
    update_user,
)
from services.errors import ServiceError

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/stats")
@auth_required(roles=["admin"])
def get_admin_stats():
    return jsonify(get_stats()), 200


@admin_bp.get("/users/<role>")
@auth_required(roles=["admin"])
def get_users(role: str):
    try:
        users = list_users(role)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify({"users": users}), 200


@admin_bp.post("/users")
@auth_required(roles=["admin"])
def post_create_user():
    body = request.get_json(silent=True) or {}
    try:
        user = create_user(body)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify({"user": user}), 201


@admin_bp.patch("/users/<user_id>")
@auth_required(roles=["admin"])
def patch_update_user(user_id: str):
    body = request.get_json(silent=True) or {}
    try:
        user = update_user(user_id, body)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify({"user": user}), 200


@admin_bp.delete("/users/<user_id>")
@auth_required(roles=["admin"])
def delete_user_route(user_id: str):
    try:
        result = delete_user(user_id)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(result), 200


@admin_bp.patch("/users/<user_id>/reset-password")
@auth_required(roles=["admin"])
def patch_reset_password(user_id: str):
    body = request.get_json(silent=True) or {}
    new_password = body.get("new_password", "")
    try:
        result = reset_password(user_id, new_password)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(result), 200