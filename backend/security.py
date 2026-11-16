import hashlib
import hmac
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt


logger = logging.getLogger(__name__)
_secret_key = os.getenv("SECRET_KEY")
if not _secret_key:
    _secret_key = secrets.token_urlsafe(48)
    logger.warning("SECRET_KEY is unset; authentication tokens will be invalidated after restart.")

_PASSWORD_ITERATIONS = 310_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        _PASSWORD_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${_PASSWORD_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt, expected = stored_hash.split("$", maxsplit=3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        if iterations < 100_000 or iterations > 2_000_000:
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            iterations,
        ).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(subject: int, role: str) -> str:
    issued_at = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "role": role,
        "iat": issued_at,
        "exp": issued_at + timedelta(hours=12),
    }
    return jwt.encode(payload, _secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, _secret_key, algorithms=["HS256"])
