"""
Authentication and Authorization Services

This module handles password hashing, JWT token generation/validation,
refresh token rotation, and current user retrieval dependencies.
"""

import os
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db import session as database
from app import models, schemas
import secrets

# JWT and Token Configuration
SECRET_KEY = os.environ.get("SECRET_KEY", "b34e40e6c5184b2ab7b8c7e9d8f9024f2b1d3a5e8c7b8d6f9a0b1c2d3e4f5a6")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Cryptographic password hashing context using Bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme for extracting Bearer tokens from request Authorization headers
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a stored bcrypt hash.

    Args:
        plain_password (str): The plaintext password provided by the user.
        hashed_password (str): The bcrypt-hashed password from the database.

    Returns:
        bool: True if the password matches, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Hash a plaintext password using bcrypt with salt.

    Args:
        password (str): The plaintext password to hash.

    Returns:
        str: The generated password hash string.
    """
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    """
    Generate a signed short-lived JSON Web Token (JWT) for authentication.

    Args:
        data (dict): Payload data containing user claims (e.g. {'sub': username}).

    Returns:
        str: Encoded JWT access token string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def create_refresh_token(user_id: int, db: AsyncSession) -> str:
    """
    Generate a cryptographically secure random refresh token and persist it in PostgreSQL.

    Args:
        user_id (int): The primary key ID of the user.
        db (AsyncSession): Active async database session.

    Returns:
        str: The generated 64-byte URL-safe refresh token string.
    """
    token = secrets.token_urlsafe(64)
    # Stored as naive UTC datetime to maintain compatibility with PostgreSQL TIMESTAMP WITHOUT TIME ZONE
    expires_at = (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).replace(tzinfo=None)
    db_token = models.RefreshToken(token=token, user_id=user_id, expires_at=expires_at)
    db.add(db_token)
    await db.commit()
    return token

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(database.get_db)) -> models.User:
    """
    FastAPI Dependency: Extract and validate the JWT Bearer token to fetch the authenticated user.

    Args:
        token (str): JWT token provided in the Authorization header.
        db (AsyncSession): Active async database session.

    Raises:
        HTTPException: 401 Unauthorized if the token is invalid, expired, or user not found.

    Returns:
        models.User: The authenticated SQLAlchemy User model instance.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode and verify the JWT signature and expiration
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Query database for the user corresponding to the token subject
    result = await db.execute(select(models.User).filter(models.User.username == username))
    user = result.scalars().first()
    
    if user is None:
        raise credentials_exception
    return user

