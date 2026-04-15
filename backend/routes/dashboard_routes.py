from flask import Blueprint, g, jsonify

from routes.decorators import auth_required
from services.dashboard_service import student_dashboard, teacher_dashboard
from services.errors import ServiceError

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/student")
@auth_required(roles=("student",))
def get_student_dashboard():
    try:
        data = student_dashboard(g.user_id)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(data), 200


@dashboard_bp.get("/teacher")
@auth_required(roles=("teacher",))
def get_teacher_dashboard():
    try:
        data = teacher_dashboard(g.user_id)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(data), 200
