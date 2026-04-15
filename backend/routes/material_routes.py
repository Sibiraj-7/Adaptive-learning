from flask import Blueprint, g, jsonify, request, send_file

from routes.decorators import auth_required
from services.errors import ServiceError
from services.material_service import (
    create_material,
    create_material_pdf_upload,
    list_materials,
    recommended_materials,
    resolve_material_file,
)

materials_bp = Blueprint("materials", __name__)


@materials_bp.get("/recommended")
@auth_required(roles=("student",))
def get_recommended_materials():
    try:
        docs = recommended_materials(g.user_id)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify({"materials": docs}), 200


@materials_bp.get("/<material_id>/file")
@auth_required(roles=("teacher", "student"))
def get_material_file(material_id: str):
    try:
        path, download_name = resolve_material_file(material_id, g.user_id, g.role)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return send_file(
        path,
        as_attachment=True,
        download_name=download_name,
        mimetype="application/pdf",
    )


@materials_bp.get("")
@auth_required(roles=("teacher", "student"))
def get_materials():
    department = request.args.get("department")
    topic = request.args.get("topic")
    difficulty = request.args.get("difficulty")
    try:
        docs = list_materials(
            g.user_id,
            g.role,
            department=department,
            topic=topic,
            difficulty=difficulty,
        )
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify({"materials": docs}), 200


@materials_bp.post("")
@auth_required(roles=("teacher",))
def post_material():
    ct = (request.content_type or "").lower()
    if "multipart/form-data" in ct:
        upload = request.files.get("file")
        form = {
            "title": request.form.get("title", ""),
            "topic": request.form.get("topic", ""),
            "difficulty": request.form.get("difficulty", ""),
            "department": request.form.get("department", ""),
            "type": request.form.get("type", "pdf"),
        }
        if upload and upload.filename:
            try:
                doc = create_material_pdf_upload(g.user_id, form, upload)
            except ServiceError as exc:
                return jsonify({"error": exc.message}), exc.status
            return jsonify(doc), 201
        body = {**form, "url": (request.form.get("url") or "").strip()}
        try:
            doc = create_material(g.user_id, body)
        except ServiceError as exc:
            return jsonify({"error": exc.message}), exc.status
        return jsonify(doc), 201

    body = request.get_json(silent=True) or {}
    try:
        doc = create_material(g.user_id, body)
    except ServiceError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(doc), 201
