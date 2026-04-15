import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from config import Config
from db.connection import get_db
from db.schema import COLLECTION_LEARNING_MATERIALS, COLLECTION_STUDENT_MASTERY, COLLECTION_USERS
from services.errors import ServiceError
from services.serialization import require_oid, serialize_doc

ALLOWED_DIFFICULTIES = ("easy", "medium", "hard")
ALLOWED_TYPES = ("pdf", "video", "link")


def _normalize_difficulty(raw: str | None) -> str:
    d = (raw or "").strip().lower()
    if d not in ALLOWED_DIFFICULTIES:
        raise ServiceError("difficulty must be easy, medium, or hard", 400)
    return d


def _normalize_type(raw: str | None) -> str:
    t = (raw or "").strip().lower()
    if t not in ALLOWED_TYPES:
        raise ServiceError("type must be pdf, video, or link", 400)
    return t


def _dept_visibility_filter(student_department: str) -> dict:
    dept = (student_department or "").strip()
    return {
        "$or": [
            {"department": {"$exists": False}},
            {"department": None},
            {"department": ""},
            {"department": dept},
        ]
    }


def _serialize_material(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    out = serialize_doc(doc)
    if not out:
        return out
    if "type" not in out and out.get("resource_type"):
        out["type"] = out["resource_type"]
    return out


def _uploads_base() -> Path:
    p = Path(Config.MATERIALS_UPLOAD_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


def create_material(teacher_id: str, payload: dict) -> dict:
    tid = require_oid(teacher_id, "teacher_id")
    title = (payload.get("title") or "").strip()
    topic = (payload.get("topic") or "").strip()
    url = (payload.get("url") or "").strip()
    department = (payload.get("department") or "").strip()
    difficulty = _normalize_difficulty(payload.get("difficulty"))
    mtype = _normalize_type(payload.get("type"))
    if not title:
        raise ServiceError("title is required", 400)
    if not topic:
        raise ServiceError("topic is required", 400)
    if not url:
        raise ServiceError("url is required", 400)

    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "title": title,
        "topic": topic,
        "difficulty": difficulty,
        "department": department,
        "type": mtype,
        "resource_type": mtype,
        "url": url,
        "uploaded_by": str(tid),
        "created_at": now,
    }
    res = db[COLLECTION_LEARNING_MATERIALS].insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize_material(doc) or {}


def create_material_pdf_upload(teacher_id: str, form: dict, file_storage: FileStorage) -> dict:
    tid = require_oid(teacher_id, "teacher_id")
    title = (form.get("title") or "").strip()
    topic = (form.get("topic") or "").strip()
    department = (form.get("department") or "").strip()
    difficulty = _normalize_difficulty(form.get("difficulty"))
    mtype = _normalize_type(form.get("type"))
    if mtype != "pdf":
        raise ServiceError("file upload is only supported for type pdf", 400)
    if not title:
        raise ServiceError("title is required", 400)
    if not topic:
        raise ServiceError("topic is required", 400)
    if not file_storage or not file_storage.filename:
        raise ServiceError("file is required", 400)

    raw_name = secure_filename(file_storage.filename) or "upload.pdf"
    if not raw_name.lower().endswith(".pdf"):
        raise ServiceError("Only .pdf files are allowed", 400)

    max_b = int(Config.MATERIALS_MAX_UPLOAD_BYTES)
    unique = f"{uuid.uuid4().hex}_{raw_name}"
    dest_dir = _uploads_base()
    dest_path = dest_dir / unique
    file_storage.save(dest_path)
    sz = dest_path.stat().st_size
    if sz > max_b:
        dest_path.unlink(missing_ok=True)
        raise ServiceError(f"File too large (max {max_b // (1024 * 1024)} MB)", 400)

    rel = f"materials/{unique}"
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "title": title,
        "topic": topic,
        "difficulty": difficulty,
        "department": department,
        "type": "pdf",
        "resource_type": "pdf",
        "url": "",
        "file_path": rel,
        "uploaded_by": str(tid),
        "created_at": now,
    }
    res = db[COLLECTION_LEARNING_MATERIALS].insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize_material(doc) or {}


def user_can_read_material(user_id: str, role: str, doc: dict | None) -> bool:
    if not doc:
        return False
    db = get_db()
    uid = require_oid(user_id, "user_id")
    if role == "teacher":
        return str(doc.get("uploaded_by") or "") == str(uid)
    if role == "student":
        student = db[COLLECTION_USERS].find_one({"_id": uid, "role": "student"})
        if not student:
            return False
        std_dept = (student.get("department") or "").strip()
        md = (doc.get("department") or "").strip()
        if not md:
            return True
        return md == std_dept
    return False


def resolve_material_file(material_id: str, user_id: str, role: str) -> tuple[Path, str]:
    mid = require_oid(material_id, "material_id")
    db = get_db()
    doc = db[COLLECTION_LEARNING_MATERIALS].find_one({"_id": mid})
    if not doc or not doc.get("file_path"):
        raise ServiceError("File not found", 404)
    if not user_can_read_material(user_id, role, doc):
        raise ServiceError("Forbidden", 403)

    rel = str(doc["file_path"]).replace("\\", "/").lstrip("/")
    if ".." in rel or rel.startswith("/"):
        raise ServiceError("Invalid file path", 400)
    uploads_root = Path(Config.MATERIALS_UPLOAD_DIR).parent
    abs_path = (uploads_root / rel).resolve()
    try:
        abs_path.relative_to(uploads_root.resolve())
    except ValueError as exc:
        raise ServiceError("Invalid file path", 400) from exc
    if not abs_path.is_file():
        raise ServiceError("File not found", 404)

    download_name = Path(rel).name
    return abs_path, download_name


def list_materials(
    user_id: str,
    role: str,
    *,
    department: str | None = None,
    topic: str | None = None,
    difficulty: str | None = None,
) -> list[dict]:
    uid = require_oid(user_id, "user_id")
    db = get_db()
    parts: list[dict] = []

    if role == "teacher":
        parts.append({"uploaded_by": str(uid)})
    elif role == "student":
        student = db[COLLECTION_USERS].find_one({"_id": uid, "role": "student"})
        if not student:
            raise ServiceError("Student not found", 403)
        std_dept = (student.get("department") or "").strip()
        parts.append(_dept_visibility_filter(std_dept))
    else:
        raise ServiceError("Forbidden", 403)

    if department is not None and str(department).strip():
        parts.append({"department": str(department).strip()})
    if topic is not None and str(topic).strip():
        parts.append(
            {
                "topic": {
                    "$regex": f"^{_regex_escape(str(topic).strip())}$",
                    "$options": "i",
                }
            }
        )
    if difficulty is not None and str(difficulty).strip():
        d = str(difficulty).strip().lower()
        if d not in ALLOWED_DIFFICULTIES:
            raise ServiceError("Invalid difficulty filter", 400)
        parts.append({"difficulty": d})

    q: dict = parts[0] if len(parts) == 1 else {"$and": parts}

    cur = db[COLLECTION_LEARNING_MATERIALS].find(q).sort("created_at", -1).limit(200)
    return [_serialize_material(d) or {} for d in cur]


def _regex_escape(s: str) -> str:
    specials = "\\.^$*+?()[]{}|"
    return "".join("\\" + c if c in specials else c for c in s)


def _mastery_tier(m: float) -> str:
    if m < 0.5:
        return "easy"
    if m <= 0.8:
        return "medium"
    return "hard"


def recommended_materials(student_id: str) -> list[dict]:
    sid = require_oid(student_id, "student_id")
    db = get_db()
    student = db[COLLECTION_USERS].find_one({"_id": sid, "role": "student"})
    if not student:
        raise ServiceError("Student not found", 403)
    std_dept = (student.get("department") or "").strip()
    vis = _dept_visibility_filter(std_dept)

    mastery_docs = list(db[COLLECTION_STUDENT_MASTERY].find({"student_id": sid}))
    topic_min: dict[str, float] = {}
    for doc in mastery_docs:
        tm = doc.get("topic_mastery") or {}
        if not isinstance(tm, dict):
            continue
        for topic_name, val in tm.items():
            if not isinstance(topic_name, str) or not topic_name.strip():
                continue
            try:
                v = float(val)
            except (TypeError, ValueError):
                continue
            tkey = topic_name.strip()
            if tkey not in topic_min:
                topic_min[tkey] = v
            else:
                topic_min[tkey] = min(topic_min[tkey], v)

    if not topic_min:
        return []

    weak = [(t, m) for t, m in topic_min.items() if m < 0.5]
    other = [(t, m) for t, m in topic_min.items() if m >= 0.5]
    ordered = sorted(weak, key=lambda x: (x[1], x[0])) + sorted(other, key=lambda x: (x[1], x[0]))
    seen: set[ObjectId] = set()
    out: list[dict] = []

    for topic_name, m in ordered:
        tier = _mastery_tier(m)
        q = {"$and": [vis, {"topic": topic_name, "difficulty": tier}]}
        for doc in db[COLLECTION_LEARNING_MATERIALS].find(q).limit(5):
            oid = doc.get("_id")
            if oid in seen:
                continue
            seen.add(oid)
            out.append(_serialize_material(doc) or {})
            if len(out) >= 25:
                return out

    return out
