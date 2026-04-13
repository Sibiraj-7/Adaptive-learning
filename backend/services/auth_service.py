from typing import Any

from werkzeug.security import check_password_hash

from db.connection import get_db
from services.errors import ServiceError


def login(email: str, password: str) -> dict[str, Any]:
    if not email or not password:
        raise ServiceError("Email and password are required", 400)

    db = get_db()

    user = db["users"].find_one({
        "email": email.strip().lower()
    })

    if not user or not check_password_hash(
        user.get("password_hash", ""), password
    ):
        raise ServiceError("Invalid email or password", 401)

    return {
        "message": "Login successful",
        "user": {
            "id": str(user["_id"]),
            "email": user.get("email"),
            "role": user.get("role"),
        }
    }