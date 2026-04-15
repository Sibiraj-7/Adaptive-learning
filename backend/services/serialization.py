from datetime import date, datetime

from bson import ObjectId
from bson.errors import InvalidId

from services.errors import ServiceError


def oid_str(value: ObjectId | str | None) -> str | None:
    if value is None:
        return None
    return str(value)


def require_oid(value: str, field: str = "id") -> ObjectId:
    try:
        return ObjectId(str(value))
    except InvalidId as exc:
        raise ServiceError(f"Invalid {field}", 400) from exc


def _jsonify_value(v):
    if isinstance(v, dict):
        return serialize_doc(v)
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date) and not isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, list):
        return [_jsonify_value(i) for i in v]
    return v


def serialize_doc(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["_id"] = str(v)
        elif isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, date):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = serialize_doc(v)
        elif isinstance(v, list):
            out[k] = [_jsonify_value(i) for i in v]
        else:
            out[k] = v
    return out


def serialize_docs(docs: list[dict]) -> list[dict]:
    return [serialize_doc(d) or {} for d in docs]
