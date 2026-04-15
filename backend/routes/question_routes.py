from flask import Blueprint, g, jsonify, request

from routes.decorators import auth_required
from services.errors import ServiceError
from services.question_service import (
    create_question,
    delete_question,
    list_questions,
    update_question,
)

questions_bp = Blueprint("questions", __name__)


@questions_bp.post("")
@auth_required(roles=("teacher",))
def post_question():
    body = request.get_json(silent=True) or {}
    try:
        doc = create_question(g.user_id, body)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(doc), 201


@questions_bp.get("")
@auth_required(roles=("teacher",))
def get_questions():
    subject = request.args.get("subject")
    topic = request.args.get("topic")
    try:
        docs = list_questions(g.user_id, subject, topic)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify({"questions": docs}), 200


@questions_bp.put("/<question_id>")
@auth_required(roles=("teacher",))
def put_question(question_id: str):
    body = request.get_json(silent=True) or {}
    try:
        doc = update_question(g.user_id, question_id, body)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(doc), 200


@questions_bp.delete("/<question_id>")
@auth_required(roles=("teacher",))
def delete_question_route(question_id: str):
    try:
        delete_question(g.user_id, question_id)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return "", 204
