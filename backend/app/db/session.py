"""
Database Session and Engine Configuration

This module configures the asynchronous SQLAlchemy engine, the sessionmaker factory,
and provides a dependency for obtaining database sessions in FastAPI route handlers.
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

# Database connection URL for PostgreSQL using the asyncpg driver
SQLALCHEMY_DATABASE_URL = "postgresql+asyncpg://chatuser:chatpassword@localhost/chat_app_prod"

# Create the asynchronous SQLAlchemy engine for non-blocking database I/O
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=False,  # Set to True if SQL query logging is needed during debugging
)

# Async session factory bound to our async engine
# expire_on_commit=False prevents attributes from being expired after commits,
# which is essential for accessing object attributes outside the immediate commit context in async code.
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base declarative class for all SQLAlchemy ORM models
Base = declarative_base()

async def get_db():
    """
    FastAPI Dependency: Yields an async SQLAlchemy database session.

    Ensures that each HTTP request or WebSocket connection gets a dedicated database
    session that is automatically closed when the request lifecycle ends.
    
    Yields:
        AsyncSession: The active database session.
    """
    async with AsyncSessionLocal() as session:
        yield session