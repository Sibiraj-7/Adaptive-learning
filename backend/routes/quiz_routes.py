from flask import Blueprint, g, jsonify, request

from routes.decorators import auth_required
from services.errors import ServiceError
from services.quiz_service import (
    assign_quiz,
    create_quiz,
    get_quiz_for_attempt,
    get_quiz_attempts_for_teacher,
    list_assignments_for_student,
    list_quizzes,
    list_student_departments,
)

quizzes_bp = Blueprint("quizzes", __name__)


@quizzes_bp.get("")
@auth_required(roles=("teacher",))
def get_quizzes():
    try:
        docs = list_quizzes(g.user_id)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify({"quizzes": docs}), 200


@quizzes_bp.get("/departments")
@auth_required(roles=("teacher",))
def get_departments():
    try:
        depts = list_student_departments(g.user_id)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify({"departments": depts}), 200


@quizzes_bp.get("/assigned")
@auth_required(roles=("student",))
def get_assigned_quizzes():
    try:
        docs = list_assignments_for_student(g.user_id)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(docs), 200


@quizzes_bp.get("/<quiz_id>/attempts")
@auth_required(roles=("teacher",))
def get_quiz_attempts(quiz_id: str):
    try:
        attempts = get_quiz_attempts_for_teacher(g.user_id, quiz_id)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(attempts), 200


@quizzes_bp.get("/take/<quiz_id>")
@auth_required(roles=("student",))
def get_quiz_take(quiz_id: str):
    aid = request.args.get("assignment_id", "")
    try:
        data = get_quiz_for_attempt(g.user_id, quiz_id, aid)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(data), 200


@quizzes_bp.post("")
@auth_required(roles=("teacher",))
def post_quiz():
    body = request.get_json(silent=True) or {}
    try:
        doc = create_quiz(g.user_id, body)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(doc), 201


@quizzes_bp.post("/assign")
@auth_required(roles=("teacher",))
def post_assign():
    body = request.get_json(silent=True) or {}
    try:
        doc = assign_quiz(g.user_id, body)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(doc), 201
