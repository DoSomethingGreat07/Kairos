from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets


@dataclass
class PasswordRecord:
    password_hash: str
    salt: str


def hash_password(password: str, salt: str | None = None) -> PasswordRecord:
    password_salt = salt or secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), password_salt.encode("utf-8"), 100_000)
    return PasswordRecord(password_hash=hashed.hex(), salt=password_salt)


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    recalculated = hash_password(password, salt=salt).password_hash
    return hmac.compare_digest(recalculated, password_hash)


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def otp_expiry(minutes: int = 10) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)
