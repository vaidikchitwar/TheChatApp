"""Unit tests for authentication, JWT generation, and password hashing."""

from datetime import datetime, timezone

import pytest
from jose import jwt

from app.services.auth import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_password_hash,
    verify_password,
)


def test_password_hashing():
    raw_password = "SecurePassword123!"
    hashed = get_password_hash(raw_password)

    assert hashed != raw_password
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_creation_and_claims():
    payload = {"sub": "alice_recruiter", "user_id": 42}
    token = create_access_token(payload)

    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded["sub"] == "alice_recruiter"
    assert decoded["user_id"] == 42
    assert "exp" in decoded
    assert decoded["exp"] > datetime.now(timezone.utc).timestamp()


def test_jwt_invalid_signature():
    token = create_access_token({"sub": "bob"})
    with pytest.raises(Exception):
        jwt.decode(token, "wrong_secret_key_1234567890123456", algorithms=[ALGORITHM])
