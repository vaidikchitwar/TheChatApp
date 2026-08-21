"""
WebSocket Connection Manager with Redis Pub/Sub

This module manages WebSocket connections across a distributed multi-instance deployment.
It maintains active local WebSocket connections and leverages Redis Pub/Sub to broadcast
and route real-time events (messages, presence, typing, read receipts) across instances.
"""

import json
import asyncio
from typing import Dict, Set, Any
from fastapi import WebSocket
import redis.asyncio as redis
import os

# Redis connection URL (configurable via environment variables)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

class ConnectionManager:
    """
    Manages local WebSocket connections and synchronizes real-time state with Redis.
    """

    def __init__(self):
        """Initialize in-memory map of active user connections and Redis client placeholders."""
        # Maps user_id -> Set of active WebSocket instances on this specific server worker
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # Async Redis client and pubsub listener references
        self.redis: redis.Redis = None
        self.pubsub: redis.client.PubSub = None
        
    async def connect_redis(self):
        """
        Establish connection to Redis and launch the background pubsub event listener task.
        Called on application startup.
        """
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)
        self.pubsub = self.redis.pubsub()
        await self.pubsub.subscribe("chat:events")
        # Launch background listener task to receive and dispatch messages from other instances
        asyncio.create_task(self._listen_to_redis())

    async def connect(self, user_id: int, websocket: WebSocket):
        """
        Accept an incoming WebSocket connection, record it locally, and track online presence in Redis.

        Args:
            user_id (int): ID of the connecting user.
            websocket (WebSocket): The accepted WebSocket connection.
        """
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        
        # Increment active socket count for user in Redis presence hash
        count = await self.redis.hincrby("presence", str(user_id), 1)
        if count == 1:
            # First time user connected globally across all server instances
            pass

    async def disconnect(self, user_id: int, websocket: WebSocket):
        """
        Remove a closed WebSocket connection from local tracking and decrement presence in Redis.

        Args:
            user_id (int): ID of the disconnecting user.
            websocket (WebSocket): The closed WebSocket connection.
        """
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                
        # Decrement user presence count in Redis; delete key if no active connections remain
        count = await self.redis.hincrby("presence", str(user_id), -1)
        if count <= 0:
            await self.redis.hdel("presence", str(user_id))

    async def send_personal_message(self, message: dict, user_id: int) -> bool:
        """
        Publish a targeted personal message to Redis to deliver to a specific user across any instance.

        Args:
            message (dict): The message payload (e.g. NEW_MESSAGE, MESSAGE_ACK, TYPING).
            user_id (int): Target user ID.

        Returns:
            bool: True upon publishing to the channel.
        """
        payload = {
            "target_user_id": user_id,
            "data": message
        }
        # Publish to the global Redis channel so whatever instance hosts the user can deliver it
        await self.redis.publish("chat:events", json.dumps(payload))
        return True

    async def broadcast(self, message: dict, exclude_user_id: int = None):
        """
        Broadcast a message globally to all connected users via Redis Pub/Sub.

        Args:
            message (dict): Event payload (e.g. PRESENCE).
            exclude_user_id (int, optional): User ID to exclude from broadcast receipt.
        """
        payload = {
            "target_user_id": "ALL",
            "exclude_user_id": exclude_user_id,
            "data": message
        }
        await self.redis.publish("chat:events", json.dumps(payload))

    async def _listen_to_redis(self):
        """
        Background worker task that listens to Redis Pub/Sub events and forwards them
        to locally connected WebSockets.
        """
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    payload = json.loads(message["data"])
                    target_user_id = payload.get("target_user_id")
                    data = payload.get("data")
                    exclude_user_id = payload.get("exclude_user_id")

                    if target_user_id == "ALL":
                        # Broadcast: send to all locally connected sockets (except excluded user)
                        for uid, websockets in self.active_connections.items():
                            if exclude_user_id is not None and uid == exclude_user_id:
                                continue
                            for ws in list(websockets):
                                try:
                                    await ws.send_json(data)
                                except Exception:
                                    pass
                    else:
                        # Targeted: send to specific user if connected to this local instance
                        if target_user_id in self.active_connections:
                            for ws in list(self.active_connections[target_user_id]):
                                try:
                                    await ws.send_json(data)
                                except Exception:
                                    pass
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Redis listener error: {e}")

# Global singleton instance of ConnectionManager
manager = ConnectionManager()

