"""
Authentication Endpoints

This router handles user registration, credential authentication (login),
refresh token rotation via HttpOnly cookies, logout revocation, and current user profile retrieval.
"""

import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app import models, schemas
from app.db import session as database
from app.services import auth as auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Curated palette of avatar background colors assigned upon user registration
COLORS = ["#FA6781", "#59B292", "#FFC94D", "#64748B", "#2C3E50"]

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user: schemas.UserCreate, db: AsyncSession = Depends(database.get_db)):
    """
    Register a new user account.

    Validates that username and email are unique, hashes the password using bcrypt,
    assigns a random avatar accent color, and persists the user in PostgreSQL.

    Args:
        user (schemas.UserCreate): Registration data (username, nickname, email, password).
        db (AsyncSession): Active database session.

    Raises:
        HTTPException: 400 Bad Request if username or email is already taken.

    Returns:
        models.User: The newly created user object.
    """
    # Check for existing user with same username or email
    result = await db.execute(select(models.User).filter(
        (models.User.username == user.username) | (models.User.email == user.email)
    ))
    db_user = result.scalars().first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username or Email already registered")
    
    # Hash password and pick a default avatar accent color
    hashed_password = auth_service.get_password_hash(user.password)
    avatar_color = random.choice(COLORS)
    
    new_user = models.User(
        username=user.username,
        nickname=user.nickname,
        email=user.email,
        hashed_password=hashed_password,
        avatar_color=avatar_color
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login")
async def login(response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(database.get_db)):
    """
    Authenticate user credentials and issue token pair.

    Validates username/email and password. Returns a short-lived access token in the JSON body,
    and sets a cryptographically random refresh token in a secure HttpOnly cookie.

    Args:
        response (Response): FastAPI response object to set cookies.
        form_data (OAuth2PasswordRequestForm): Standard OAuth2 form containing username and password.
        db (AsyncSession): Active database session.

    Raises:
        HTTPException: 401 Unauthorized if credentials are invalid.

    Returns:
        dict: Access token and token type.
    """
    # Look up user by either username or email
    result = await db.execute(select(models.User).filter(
        (models.User.username == form_data.username) | (models.User.email == form_data.username)
    ))
    user = result.scalars().first()
    
    # Verify password hash
    if not user or not auth_service.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Issue short-lived JWT access token
    access_token = auth_service.create_access_token(data={"sub": user.username})
    
    # Generate and store persistent refresh token
    refresh_token = await auth_service.create_refresh_token(user_id=user.id, db=db)
    
    # Set HttpOnly cookie for refresh token to prevent XSS theft
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=auth_service.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh")
async def refresh_token(response: Response, refresh_token: str | None = Cookie(None), db: AsyncSession = Depends(database.get_db)):
    """
    Rotate refresh token and issue a new access token.

    Validates the refresh token from the HttpOnly cookie, marks it as revoked (single-use rotation),
    generates a brand new refresh token, and returns a new access token.

    Args:
        response (Response): FastAPI response object to set new cookie.
        refresh_token (str, optional): Refresh token extracted from request cookie.
        db (AsyncSession): Active database session.

    Raises:
        HTTPException: 401 Unauthorized if refresh token is missing, expired, or revoked.

    Returns:
        dict: New access token and token type.
    """
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
        
    result = await db.execute(select(models.RefreshToken).filter(
        models.RefreshToken.token == refresh_token,
        models.RefreshToken.is_revoked == False
    ))
    db_token = result.scalars().first()
    
    # Validate expiration
    if not db_token or db_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
        
    # Rotate the refresh token: revoke the old one
    db_token.is_revoked = True
    
    user_result = await db.execute(select(models.User).filter(models.User.id == db_token.user_id))
    user = user_result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    # Create new pair
    new_access_token = auth_service.create_access_token(data={"sub": user.username})
    new_refresh_token = await auth_service.create_refresh_token(user_id=user.id, db=db)
    
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=auth_service.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(response: Response, refresh_token: str | None = Cookie(None), db: AsyncSession = Depends(database.get_db)):
    """
    Log out the user.

    Revokes the active refresh token in the database and clears the refresh_token cookie from the client.

    Args:
        response (Response): FastAPI response to delete cookie.
        refresh_token (str, optional): Current refresh token from cookie.
        db (AsyncSession): Active database session.

    Returns:
        dict: Success message.
    """
    if refresh_token:
        result = await db.execute(select(models.RefreshToken).filter(models.RefreshToken.token == refresh_token))
        db_token = result.scalars().first()
        if db_token:
            db_token.is_revoked = True
            await db.commit()
            
    response.delete_cookie(key="refresh_token")
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=schemas.UserResponse)
async def get_me(current_user: models.User = Depends(auth_service.get_current_user)):
    """
    Fetch the currently authenticated user's profile.

    Args:
        current_user (models.User): Authenticated user injected by get_current_user dependency.

    Returns:
        models.User: Current user profile data.
    """
    return current_user

@router.post("/change-password")
async def change_password(
    password_data: schemas.ChangePasswordRequest,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """
    Update the authenticated user's password.
    """
    # Verify current password
    if not auth_service.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    # Hash and update to new password
    current_user.hashed_password = auth_service.get_password_hash(password_data.new_password)
    
    # Optionally: Revoke all refresh tokens so other sessions are logged out
    result = await db.execute(select(models.RefreshToken).filter(models.RefreshToken.user_id == current_user.id))
    tokens = result.scalars().all()
    for token in tokens:
        token.is_revoked = True
        
    await db.commit()
    return {"message": "Password updated successfully. Other sessions logged out."}

