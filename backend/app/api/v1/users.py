"""
User Directory Endpoints

This router provides endpoints for discovering and listing registered users in the application.
"""

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app import models, schemas
from app.db import session as database
from app.services import auth as auth_service

router = APIRouter(prefix="/api/v1/users", tags=["users"])

from sqlalchemy import select, or_, and_

@router.get("", response_model=List[schemas.UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """
    List available users for initiating conversations.

    Excludes the authenticated requesting user from the result set and supports offset pagination.
    Also excludes users who are blocked or have blocked the current user.
    """
    # Subquery to get IDs of users who are in a BLOCKED relationship with current_user
    blocked_subq = select(models.Friendship.friend_id).filter(
        models.Friendship.user_id == current_user.id,
        models.Friendship.status == models.FriendshipStatus.BLOCKED
    )
    blocker_subq = select(models.Friendship.user_id).filter(
        models.Friendship.friend_id == current_user.id,
        models.Friendship.status == models.FriendshipStatus.BLOCKED
    )
    
    result = await db.execute(
        select(models.User)
        .filter(models.User.id != current_user.id)
        .filter(models.User.id.not_in(blocked_subq))
        .filter(models.User.id.not_in(blocker_subq))
        .offset(skip)
        .limit(limit)
    )
    users = result.scalars().all()
    return users

from fastapi import HTTPException

@router.get("/search", response_model=schemas.UserResponse)
async def search_user_by_username(
    username: str,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """
    Find a specific user by their exact username.
    Used for sending friend requests.
    """
    # Exclude if blocked
    blocked_subq = select(models.Friendship.friend_id).filter(
        models.Friendship.user_id == current_user.id,
        models.Friendship.status == models.FriendshipStatus.BLOCKED
    )
    blocker_subq = select(models.Friendship.user_id).filter(
        models.Friendship.friend_id == current_user.id,
        models.Friendship.status == models.FriendshipStatus.BLOCKED
    )
    
    result = await db.execute(
        select(models.User)
        .filter(models.User.username == username)
        .filter(models.User.id != current_user.id)
        .filter(models.User.id.not_in(blocked_subq))
        .filter(models.User.id.not_in(blocker_subq))
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return user

@router.patch("/me", response_model=schemas.UserResponse)
async def update_profile(
    profile_update: schemas.UserProfileUpdate,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """
    Update the authenticated user's profile information.
    """
    update_data = profile_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)
    
    await db.commit()
    await db.refresh(current_user)
    return current_user

import os
import uuid
import shutil
from fastapi import UploadFile, File, HTTPException, status

@router.post("/me/avatar", response_model=schemas.UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """
    Upload a new avatar image.
    """
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Create unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{current_user.id}_{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join("uploads", filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Construct URL (assuming frontend can access /uploads directly as static)
    avatar_url = f"/uploads/{filename}"
    
    # Remove old avatar if exists
    if current_user.avatar_url and current_user.avatar_url.startswith("/uploads/"):
        old_file = os.path.join("uploads", current_user.avatar_url.split("/")[-1])
        if os.path.exists(old_file):
            os.remove(old_file)
            
    current_user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(current_user)
    
    return current_user

