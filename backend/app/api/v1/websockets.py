"""
Real-time WebSocket Endpoint

This module handles bidirectional WebSocket connections for real-time messaging,
typing indicators, message delivery/read receipts, user presence updates,
and idempotency checking via client_message_id.
"""

import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app import models
from app.db import session as database
from app.services import auth as auth_service
from app.websocket.manager import manager

router = APIRouter(prefix="/api/v1/websockets", tags=["websockets"])

@router.websocket("/ws/{token}")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    db: AsyncSession = Depends(database.get_db)
):
    """
    WebSocket Connection Handler for Authenticated Users.

    Protocol Lifecycle:
    1. Authenticate user from JWT token parameter.
    2. Register socket in local ConnectionManager and Redis presence.
    3. Broadcast PRESENCE (ONLINE) event to cluster.
    4. Enter message receive loop:
       - 'NEW_MESSAGE': Validates idempotency via client_message_id, persists to DB,
         sends immediate MESSAGE_ACK to sender, and delivers to participants via Redis.
       - 'TYPING': Broadcasts typing notification to conversation participants.
       - 'MESSAGE_READ': Updates message status to READ and notifies the sender.
    5. On disconnect: Cleans up connection, updates last_seen timestamp in PostgreSQL,
       and broadcasts PRESENCE (OFFLINE).

    Args:
        websocket (WebSocket): Incoming WebSocket connection.
        token (str): JWT Bearer token passed in the connection URL path.
        db (AsyncSession): Active database session.
    """
    # 1. Authenticate user from token
    try:
        user = await auth_service.get_current_user(token=token, db=db)
    except HTTPException:
        # Reject unauthorized connections with Policy Violation code
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Register socket connection locally and increment presence in Redis
    await manager.connect(user.id, websocket)
    
    # Mark user as online in database
    user.is_online = True
    await db.commit()
    
    # 3. Broadcast online presence to all other users across the cluster
    await manager.broadcast({
        "type": "PRESENCE",
        "user_id": user.id,
        "status": "ONLINE"
    }, exclude_user_id=user.id)

    try:
        while True:
            # Receive incoming text frame from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            msg_type = message_data.get("type")

            # --- Handler: NEW_MESSAGE ---
            if msg_type == "NEW_MESSAGE":
                conversation_id = message_data.get("conversation_id")
                content = message_data.get("content")
                client_message_id = message_data.get("client_message_id")
                
                # 1. Idempotency check: if client_message_id exists, do not duplicate
                if client_message_id:
                    existing_result = await db.execute(
                        select(models.Message).filter(models.Message.client_message_id == client_message_id)
                    )
                    existing_msg = existing_result.scalars().first()
                    if existing_msg:
                        # Re-send ACK back to sender immediately
                        await manager.send_personal_message({
                            "type": "MESSAGE_ACK",
                            "client_message_id": client_message_id,
                            "message_id": existing_msg.id,
                            "status": existing_msg.status.value,
                            "created_at": existing_msg.created_at.isoformat()
                        }, user.id)
                        continue

                # Verify sender is a valid participant of the conversation
                result = await db.execute(select(models.ConversationParticipant).filter(
                    models.ConversationParticipant.conversation_id == conversation_id,
                    models.ConversationParticipant.user_id == user.id
                ))
                participant = result.scalars().first()
                
                if participant:
                    # Persist new message in database
                    new_msg = models.Message(
                        client_message_id=client_message_id,
                        conversation_id=conversation_id,
                        sender_id=user.id,
                        content=content,
                        status=models.MessageStatus.SENT
                    )
                    db.add(new_msg)
                    
                    # Update conversation last modified timestamp
                    conv_result = await db.execute(select(models.Conversation).filter(models.Conversation.id == conversation_id))
                    conv = conv_result.scalars().first()
                    if conv:
                        conv.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    
                    await db.commit()
                    await db.refresh(new_msg)
                    
                    # 2. Return immediate MESSAGE_ACK to sender
                    await manager.send_personal_message({
                        "type": "MESSAGE_ACK",
                        "client_message_id": client_message_id,
                        "message_id": new_msg.id,
                        "status": new_msg.status.value,
                        "created_at": new_msg.created_at.isoformat()
                    }, user.id)
                    
                    # 3. Deliver NEW_MESSAGE payload to all other participants
                    op_result = await db.execute(select(models.ConversationParticipant).filter(
                        models.ConversationParticipant.conversation_id == conversation_id,
                        models.ConversationParticipant.user_id != user.id
                    ))
                    other_participants = op_result.scalars().all()
                    
                    payload = {
                        "type": "NEW_MESSAGE",
                        "message": {
                            "id": new_msg.id,
                            "client_message_id": new_msg.client_message_id,
                            "conversation_id": new_msg.conversation_id,
                            "sender_id": new_msg.sender_id,
                            "content": new_msg.content,
                            "status": new_msg.status.value,
                            "created_at": new_msg.created_at.isoformat()
                        }
                    }
                    
                    for op in other_participants:
                        delivered = await manager.send_personal_message(payload, op.user_id)
                        if delivered and new_msg.status == models.MessageStatus.SENT:
                            new_msg.status = models.MessageStatus.DELIVERED
                            await db.commit()

            # --- Handler: TYPING Indicator ---
            elif msg_type == "TYPING":
                conversation_id = message_data.get("conversation_id")
                op_result = await db.execute(select(models.ConversationParticipant).filter(
                    models.ConversationParticipant.conversation_id == conversation_id,
                    models.ConversationParticipant.user_id != user.id
                ))
                other_participants = op_result.scalars().all()
                for op in other_participants:
                    await manager.send_personal_message({
                        "type": "TYPING",
                        "conversation_id": conversation_id,
                        "user_id": user.id
                    }, op.user_id)

            # --- Handler: MESSAGE_READ Receipt ---
            elif msg_type == "MESSAGE_READ":
                message_id = message_data.get("message_id")
                msg_result = await db.execute(select(models.Message).filter(models.Message.id == message_id))
                msg = msg_result.scalars().first()
                if msg and msg.sender_id != user.id:
                    msg.status = models.MessageStatus.READ
                    await db.commit()
                    
                    # Notify message sender that message has been read
                    await manager.send_personal_message({
                        "type": "MESSAGE_READ",
                        "message_id": message_id,
                        "conversation_id": msg.conversation_id,
                        "user_id": user.id
                    }, msg.sender_id)

    except WebSocketDisconnect:
        # Disconnect cleanup: unregister local socket and decrement Redis presence
        await manager.disconnect(user.id, websocket)
        user.is_online = False
        user.last_seen = datetime.now(timezone.utc).replace(tzinfo=None)
        await db.commit()
        # Broadcast offline status to remaining connected clients
        await manager.broadcast({
            "type": "PRESENCE",
            "user_id": user.id,
            "status": "OFFLINE",
            "last_seen": user.last_seen.isoformat()
        }, exclude_user_id=user.id)

