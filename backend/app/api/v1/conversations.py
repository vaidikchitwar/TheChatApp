"""
Conversation and Messaging History Endpoints

This router manages 1-on-1 and group conversations, participant assignments,
and cursor-based historical message retrieval for infinite scrolling.
"""

import base64
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app import models, schemas
from app.db import session as database
from app.services import auth as auth_service

router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])

@router.get("", response_model=List[schemas.ConversationResponse])
async def get_conversations(
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """
    List all active conversations for the authenticated user.

    Eagerly loads participant associations and user profiles, ordered by the most recently updated.

    Args:
        db (AsyncSession): Active database session.
        current_user (models.User): Authenticated user.

    Returns:
        List[models.Conversation]: List of conversation objects with populated participants.
    """
    # Find all conversation IDs that current user is a participant of
    result = await db.execute(select(models.ConversationParticipant).filter(models.ConversationParticipant.user_id == current_user.id))
    participant_records = result.scalars().all()
    conversation_ids = [p.conversation_id for p in participant_records]
    
    # Eagerly load participant relation and nested user profile
    result = await db.execute(
        select(models.Conversation)
        .options(
            selectinload(models.Conversation.participants).selectinload(models.ConversationParticipant.user)
        )
        .filter(models.Conversation.id.in_(conversation_ids))
        .order_by(models.Conversation.updated_at.desc())
    )
    conversations = result.scalars().all()
    return conversations

@router.post("", response_model=schemas.ConversationResponse)
async def create_or_fetch_conversation(
    target_user_id: int,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """
    Get existing 1-on-1 conversation or create a new one between current user and target user.

    Args:
        target_user_id (int): Primary key ID of the other chat participant.
        db (AsyncSession): Active database session.
        current_user (models.User): Authenticated user.

    Raises:
        HTTPException: 400 Bad Request if trying to chat with self.
        HTTPException: 404 Not Found if target user does not exist.

    Returns:
        models.Conversation: The existing or newly created conversation with participants loaded.
    """
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot create conversation with yourself")
    
    # Verify target user exists
    result = await db.execute(select(models.User).filter(models.User.id == target_user_id))
    target_user = result.scalars().first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Find conversations that current user participates in
    cu_result = await db.execute(select(models.ConversationParticipant.conversation_id).filter(models.ConversationParticipant.user_id == current_user.id))
    cu_conversations = cu_result.scalars().all()
    
    # Check if a 1-on-1 conversation between both users already exists
    shared_conv_result = await db.execute(select(models.ConversationParticipant.conversation_id).filter(
        models.ConversationParticipant.user_id == target_user.id,
        models.ConversationParticipant.conversation_id.in_(cu_conversations)
    ))
    shared_conv = shared_conv_result.scalars().first()

    if shared_conv:
        conv_result = await db.execute(
            select(models.Conversation)
            .options(
                selectinload(models.Conversation.participants).selectinload(models.ConversationParticipant.user)
            )
            .filter(models.Conversation.id == shared_conv)
        )
        conv = conv_result.scalars().first()
        if not conv.is_group:
            return conv

    # Otherwise, create a new conversation record
    new_conv = models.Conversation(is_group=False)
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)

    # Attach both participants to the conversation
    p1 = models.ConversationParticipant(conversation_id=new_conv.id, user_id=current_user.id)
    p2 = models.ConversationParticipant(conversation_id=new_conv.id, user_id=target_user_id)
    db.add_all([p1, p2])
    await db.commit()

    # Reload with participants and user relations populated for response
    loaded_result = await db.execute(
        select(models.Conversation)
        .options(
            selectinload(models.Conversation.participants).selectinload(models.ConversationParticipant.user)
        )
        .filter(models.Conversation.id == new_conv.id)
    )
    return loaded_result.scalars().first()

def encode_cursor(message_id: int) -> str:
    """
    Encode an integer message ID into an opaque base64 string cursor.

    Args:
        message_id (int): Primary key ID of the message.

    Returns:
        str: Base64 encoded cursor token.
    """
    return base64.b64encode(str(message_id).encode()).decode()

def decode_cursor(cursor_str: str) -> int:
    """
    Decode an opaque base64 cursor token back into an integer message ID.

    Args:
        cursor_str (str): Base64 encoded cursor string.

    Raises:
        HTTPException: 400 Bad Request if the cursor is malformed.

    Returns:
        int: Decoded message ID.
    """
    try:
        return int(base64.b64decode(cursor_str.encode()).decode())
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid cursor")

@router.get("/{conversation_id}/messages", response_model=schemas.MessagePage)
async def get_messages(
    conversation_id: int, 
    cursor: Optional[str] = None, 
    limit: int = Query(50, le=100), 
    db: AsyncSession = Depends(database.get_db), 
    current_user: models.User = Depends(auth_service.get_current_user)
):
    """
    Retrieve paginated chat message history using cursor-based pagination.

    Fetches messages older than the given cursor position in descending chronological order.
    Ensures that only participants in the conversation can access its messages.

    Args:
        conversation_id (int): ID of the conversation.
        cursor (str, optional): Opaque cursor for pagination (encodes last seen message ID).
        limit (int): Maximum messages to return per page (default 50, max 100).
        db (AsyncSession): Active database session.
        current_user (models.User): Authenticated user.

    Raises:
        HTTPException: 403 Forbidden if current user is not a participant in this conversation.

    Returns:
        schemas.MessagePage: List of messages and the next_cursor token for the next page.
    """
    # Verify requesting user is a legitimate participant in this conversation
    result = await db.execute(select(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conversation_id,
        models.ConversationParticipant.user_id == current_user.id
    ))
    participant = result.scalars().first()
    if not participant:
        raise HTTPException(status_code=403, detail="Not part of this conversation")

    query = select(models.Message).filter(models.Message.conversation_id == conversation_id)
    
    # Cursor pagination: get messages strictly older than the cursor (id < cursor)
    if cursor:
        last_id = decode_cursor(cursor)
        query = query.filter(models.Message.id < last_id)
        
    query = query.order_by(desc(models.Message.id)).limit(limit)
    
    result = await db.execute(query)
    messages = result.scalars().all()
    
    # Generate next cursor from the oldest message in this batch if full page was returned
    next_cursor = encode_cursor(messages[-1].id) if len(messages) == limit else None
    
    return {"items": messages, "next_cursor": next_cursor}

