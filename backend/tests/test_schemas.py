"""Unit tests for Pydantic schemas and DTOs in TheChatApp."""

import pytest
from pydantic import ValidationError

from app import schemas


def test_user_create_validation():
    user = schemas.UserCreate(
        username="recruiterjane",
        nickname="Jane",
        email="recruiter.jane@example.com",
        password="SecurePassword123",
    )
    assert user.username == "recruiterjane"
    assert user.nickname == "Jane"
    assert user.email == "recruiter.jane@example.com"


def test_user_create_invalid_email():
    with pytest.raises(ValidationError):
        schemas.UserCreate(
            username="invaliduser",
            nickname="Invalid",
            email="not-an-email",
            password="SecurePassword123",
        )


def test_message_create_schema():
    msg = schemas.MessageCreate(
        content="Hey, let's schedule an interview!",
        client_message_id="uuid-1234-5678",
    )
    assert msg.content == "Hey, let's schedule an interview!"
    assert msg.client_message_id == "uuid-1234-5678"


def test_token_response_schema():
    token = schemas.Token(
        access_token="sample_jwt_token_payload",
        refresh_token="sample_refresh_token_payload",
        token_type="bearer",
    )
    assert token.token_type == "bearer"
    assert token.access_token.startswith("sample_jwt")
