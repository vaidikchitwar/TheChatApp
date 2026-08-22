"""
Friendship Endpoints

This router manages sending, accepting, rejecting friend requests, 
blocking users, and retrieving friend lists.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app import models, schemas
from app.db import session as database
from app.services import auth as auth_service

router = APIRouter(prefix="/api/v1/friends", tags=["friends"])

@router.post("/request", response_model=schemas.FriendshipResponse)
async def send_friend_request(
    target_user_id: int,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """Send a friend request to another user."""
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send a friend request to yourself")
        
    # Check if target user exists
    target = await db.get(models.User, target_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check existing relationship
    result = await db.execute(
        select(models.Friendship).filter(
            or_(
                and_(models.Friendship.user_id == current_user.id, models.Friendship.friend_id == target_user_id),
                and_(models.Friendship.user_id == target_user_id, models.Friendship.friend_id == current_user.id)
            )
        )
    )
    existing = result.scalars().all()
    
    if existing:
        for relation in existing:
            if relation.status == models.FriendshipStatus.BLOCKED:
                raise HTTPException(status_code=403, detail="Cannot send friend request (Blocked)")
            if relation.status == models.FriendshipStatus.ACCEPTED:
                raise HTTPException(status_code=400, detail="Already friends")
            if relation.status == models.FriendshipStatus.PENDING:
                if relation.user_id == current_user.id:
                    raise HTTPException(status_code=400, detail="Friend request already sent")
                else:
                    raise HTTPException(status_code=400, detail="User already sent you a request. Accept it instead.")

    # Create new friendship request
    new_request = models.Friendship(
        user_id=current_user.id,
        friend_id=target_user_id,
        status=models.FriendshipStatus.PENDING
    )
    db.add(new_request)
    await db.commit()
    await db.refresh(new_request)
    
    # Load friend profile for response
    await db.refresh(new_request, ["friend"])
    return new_request

@router.post("/accept", response_model=schemas.FriendshipResponse)
async def accept_friend_request(
    friendship_id: int,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """Accept an incoming friend request."""
    result = await db.execute(
        select(models.Friendship)
        .options(selectinload(models.Friendship.user), selectinload(models.Friendship.friend))
        .filter(models.Friendship.id == friendship_id)
    )
    friendship = result.scalars().first()
    
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
        
    # Only the receiver (friend_id) can accept the request
    if friendship.friend_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to accept this request")
        
    if friendship.status != models.FriendshipStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Request is already {friendship.status.value.lower()}")
        
    friendship.status = models.FriendshipStatus.ACCEPTED
    await db.commit()
    await db.refresh(friendship)
    
    return friendship

@router.post("/reject")
async def reject_friend_request(
    friendship_id: int,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """Reject or cancel a pending friend request."""
    result = await db.execute(
        select(models.Friendship).filter(models.Friendship.id == friendship_id)
    )
    friendship = result.scalars().first()
    
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
        
    if current_user.id not in [friendship.user_id, friendship.friend_id]:
        raise HTTPException(status_code=403, detail="Not authorized to reject this request")
        
    if friendship.status != models.FriendshipStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only reject/cancel pending requests")
        
    await db.delete(friendship)
    await db.commit()
    return {"message": "Request removed successfully"}

@router.post("/block")
async def block_user(
    target_user_id: int,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """Block a user, removing any existing friendship."""
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
        
    # Check if existing relationship exists and delete it
    result = await db.execute(
        select(models.Friendship).filter(
            or_(
                and_(models.Friendship.user_id == current_user.id, models.Friendship.friend_id == target_user_id),
                and_(models.Friendship.user_id == target_user_id, models.Friendship.friend_id == current_user.id)
            )
        )
    )
    existing = result.scalars().all()
    for rel in existing:
        if rel.status == models.FriendshipStatus.BLOCKED and rel.user_id == current_user.id:
            raise HTTPException(status_code=400, detail="User already blocked")
        await db.delete(rel)
        
    new_block = models.Friendship(
        user_id=current_user.id,
        friend_id=target_user_id,
        status=models.FriendshipStatus.BLOCKED
    )
    db.add(new_block)
    await db.commit()
    return {"message": "User blocked successfully"}

@router.post("/unblock")
async def unblock_user(
    target_user_id: int,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """Unblock a previously blocked user."""
    result = await db.execute(
        select(models.Friendship).filter(
            models.Friendship.user_id == current_user.id,
            models.Friendship.friend_id == target_user_id,
            models.Friendship.status == models.FriendshipStatus.BLOCKED
        )
    )
    block = result.scalars().first()
    if not block:
        raise HTTPException(status_code=404, detail="Block record not found")
        
    await db.delete(block)
    await db.commit()
    return {"message": "User unblocked successfully"}

@router.get("", response_model=List[schemas.FriendshipResponse])
async def get_friends(
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """Get all accepted friends."""
    result = await db.execute(
        select(models.Friendship)
        .options(selectinload(models.Friendship.user), selectinload(models.Friendship.friend))
        .filter(
            or_(models.Friendship.user_id == current_user.id, models.Friendship.friend_id == current_user.id),
            models.Friendship.status == models.FriendshipStatus.ACCEPTED
        )
    )
    friendships = result.scalars().all()
    
    # Normalize the 'friend' field so it always points to the OTHER person
    for f in friendships:
        if f.user_id != current_user.id:
            f.friend = f.user
            
    return friendships

@router.get("/pending", response_model=List[schemas.FriendshipResponse])
async def get_pending_requests(
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """Get all pending incoming and outgoing friend requests."""
    result = await db.execute(
        select(models.Friendship)
        .options(selectinload(models.Friendship.user), selectinload(models.Friendship.friend))
        .filter(
            or_(models.Friendship.user_id == current_user.id, models.Friendship.friend_id == current_user.id),
            models.Friendship.status == models.FriendshipStatus.PENDING
        )
    )
    requests = result.scalars().all()
    
    for req in requests:
        if req.user_id != current_user.id:
            req.friend = req.user
            
    return requests

@router.get("/blocked", response_model=List[schemas.FriendshipResponse])
async def get_blocked_users(
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """Get all users blocked by the current user."""
    result = await db.execute(
        select(models.Friendship)
        .options(selectinload(models.Friendship.friend))
        .filter(
            models.Friendship.user_id == current_user.id,
            models.Friendship.status == models.FriendshipStatus.BLOCKED
        )
    )
    return result.scalars().all()
