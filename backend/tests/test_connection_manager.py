"""Unit tests for WebSocket ConnectionManager and Redis event distribution."""

import json
from unittest.mock import AsyncMock

import pytest

from app.websocket.manager import ConnectionManager


@pytest.fixture
def mock_websocket():
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    return ws


@pytest.fixture
def manager():
    mgr = ConnectionManager()
    mgr.redis = AsyncMock()
    mgr.redis.hincrby = AsyncMock(return_value=1)
    mgr.redis.hdel = AsyncMock()
    mgr.redis.publish = AsyncMock()
    return mgr


@pytest.mark.asyncio
async def test_websocket_connect(manager, mock_websocket):
    user_id = 101
    await manager.connect(user_id, mock_websocket)

    mock_websocket.accept.assert_awaited_once()
    assert user_id in manager.active_connections
    assert mock_websocket in manager.active_connections[user_id]
    manager.redis.hincrby.assert_awaited_with("presence", str(user_id), 1)


@pytest.mark.asyncio
async def test_websocket_disconnect(manager, mock_websocket):
    user_id = 101
    await manager.connect(user_id, mock_websocket)

    manager.redis.hincrby.return_value = 0
    await manager.disconnect(user_id, mock_websocket)

    assert user_id not in manager.active_connections
    manager.redis.hdel.assert_awaited_with("presence", str(user_id))


@pytest.mark.asyncio
async def test_send_personal_message_publishes_to_redis(manager):
    msg = {"type": "NEW_MESSAGE", "content": "Hello World"}
    result = await manager.send_personal_message(msg, user_id=99)

    assert result is True
    manager.redis.publish.assert_awaited_once()
    channel, raw_payload = manager.redis.publish.call_args[0]
    assert channel == "chat:events"
    payload = json.loads(raw_payload)
    assert payload["target_user_id"] == 99
    assert payload["data"]["content"] == "Hello World"


@pytest.mark.asyncio
async def test_broadcast_publishes_to_all(manager):
    event = {"type": "USER_ONLINE", "user_id": 5}
    await manager.broadcast(event, exclude_user_id=5)

    manager.redis.publish.assert_awaited_once()
    channel, raw_payload = manager.redis.publish.call_args[0]
    payload = json.loads(raw_payload)
    assert payload["target_user_id"] == "ALL"
    assert payload["exclude_user_id"] == 5
