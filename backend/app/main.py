"""
Main Application Entrypoint

This module creates the FastAPI application instance, registers lifecycle events
(Redis connection on startup, resource cleanup on shutdown), configures CORS middleware,
and mounts all version 1 API and WebSocket routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, conversations, users, websockets
from app.websocket.manager import manager

# Initialize FastAPI application
app = FastAPI(
    title="Chat Application",
    description="High-performance, multi-user real-time chat application with PostgreSQL, Redis Pub/Sub, and WebSockets.",
    version="1.0.0"
)

@app.on_event("startup")
async def startup():
    """
    Application Startup Lifecycle Hook.
    Connects the global ConnectionManager to Redis and starts the pub/sub listener.
    """
    await manager.connect_redis()

@app.on_event("shutdown")
async def shutdown():
    """
    Application Shutdown Lifecycle Hook.
    Gracefully closes active Redis connections and cleans up background tasks.
    """
    if manager.redis:
        await manager.redis.aclose()

# Configure Cross-Origin Resource Sharing (CORS) to allow browser frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register REST and WebSocket API Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(conversations.router)
app.include_router(websockets.router)