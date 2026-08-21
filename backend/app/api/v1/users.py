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

    Args:
        skip (int): Number of records to skip (offset).
        limit (int): Maximum number of users to return.
        db (AsyncSession): Active database session.
        current_user (models.User): The currently authenticated user.

    Returns:
        List[models.User]: List of other registered users.
    """
    result = await db.execute(
        select(models.User)
        .filter(models.User.id != current_user.id)
        .offset(skip)
        .limit(limit)
    )
    users = result.scalars().all()
    return users

