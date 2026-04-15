from typing import Any

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash

from config import Config
from db.connection import get_db
from db.schema import COLLECTION_USERS
from services.errors import ServiceError
from services.serialization import serialize_doc

_TOKEN_MAX_AGE_SEC = 60 * 60 * 24 * 7


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(
        Config.SECRET_KEY,
        salt="adaptive-learning-auth",
    )


def issue_token(user_id: str, role: str) -> str:
    return _serializer().dumps({"uid": user_id, "role": role})


def verify_token(token: str) -> dict[str, str]:
    try:
        data = _serializer().loads(token, max_age=_TOKEN_MAX_AGE_SEC)
    except SignatureExpired as exc:
        raise ServiceError("Token expired", 401) from exc
    except BadSignature as exc:
        raise ServiceError("Invalid token", 401) from exc
    uid = data.get("uid")
    role = data.get("role")
    if not uid or not role:
        raise ServiceError("Invalid token", 401)
    return {"uid": str(uid), "role": str(role)}


def login(email: str, password: str) -> dict[str, Any]:
    if not email or not password:
        raise ServiceError("Email and password are required", 400)

    db = get_db()
    user = db[COLLECTION_USERS].find_one({"email": email.strip().lower()})
    if not user or not check_password_hash(user.get("password_hash", ""), password):
        raise ServiceError("Invalid email or password", 401)

    uid = str(user["_id"])
    token = issue_token(uid, user["role"])
    public = serialize_doc(user) or {}
    public.pop("password_hash", None)
    return {"token": token, "user": public}
