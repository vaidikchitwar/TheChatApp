# Ultimate Chat App (UCA)

> **A high-concurrency, horizontally scalable real-time messaging engine built with FastAPI, Redis Pub/Sub, WebSockets, PostgreSQL, and React.**

[![CI/CD Pipeline](https://github.com/vaidikchitwar/TheChatApp/actions/workflows/ci.yml/badge.svg)](https://github.com/vaidikchitwar/TheChatApp/actions)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Pub%2FSub-DC382D?logo=redis&logoColor=white)
![WebSockets](https://img.shields.io/badge/WebSockets-Real--Time-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-Frontend-646CFF?logo=vite&logoColor=white)
![Docker Compose](https://img.shields.io/badge/Docker-Compose_Ready-2496ED?logo=docker&logoColor=white)

[**Live Demo Placeholder**](https://uca.demo.app) • [**Video Walkthrough Placeholder**](https://youtube.com) • [**API Docs (Swagger)**](http://localhost:8000/docs)

---

## 1. The Engineering Problem & Solution

Standard WebSocket chat tutorials fail in real-world production due to architectural bottlenecks:

* **Single-Process WebSocket Memory Isolation:** Traditional WebSocket servers keep connections in process memory. When traffic spikes and the server scales horizontally to multiple worker processes or nodes, User A connected to Node 1 cannot send messages to User B connected to Node 2. **UCA resolves this with a distributed Redis Pub/Sub backbone: events are published to a unified channel (`chat:events`), allowing any worker instance hosting the recipient socket to deserialize and dispatch the payload instantly.**
* **Connection Drops & Ghost Presence State:** Naive connection trackers mark users offline prematurely during brief mobile network handoffs or leave ghost "online" indicators when tabs close without a TCP teardown. **UCA implements atomic Redis presence counters (`HINCRBY`/`HDEL`) synchronized with client-side heartbeat pings, ensuring accurate multi-tab global online status and immediate offline garbage collection.**
* **Message Duplication & Ordering Anarchy Under Network Retries:** Mobile network re-connections trigger repeated HTTP/WS packet sends. **UCA enforces idempotent message processing using client-generated idempotency keys (`client_message_id`) paired with transactional PostgreSQL storage, guaranteeing zero message duplication and deterministic conversation timestamps.**

---

## 2. System Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Client A)
    participant Worker1 as Backend Node 1 (FastAPI)
    participant Redis as Redis (Pub/Sub & Presence)
    participant DB as PostgreSQL (AsyncPG)
    participant Worker2 as Backend Node 2 (FastAPI)
    actor Bob as Bob (Client B)

    Alice->>Worker1: 1. WebSocket Connect + Bearer JWT
    Worker1->>Redis: 2. HINCRBY presence (Alice=Online)
    Worker1-->>Alice: 3. Connection Accepted (ACK)

    Alice->>Worker1: 4. Send Message (payload, client_message_id)
    Worker1->>DB: 5. Persist message transactionally
    Worker1->>Redis: 6. PUBLISH "chat:events" (Target: Bob, data)

    Redis-->>Worker2: 7. Dispatch event to subscribed Node 2
    Worker2->>Bob: 8. Deliver via local WebSocket
    Bob-->>Worker2: 9. Read Receipt ACK
    Worker2->>Redis: 10. PUBLISH Read Status to Alice
```

---

## 3. Key Technical Highlights & Benchmarks

| Metric | Target / Benchmark | Implementation Detail |
| :--- | :--- | :--- |
| **WebSocket Latency** | **< 15 ms P99** | Redis Pub/Sub inter-process message propagation |
| **Concurrent Connections** | **10,000+ Concurrent Sockets** | Non-blocking async event loop (`uvicorn` + `asyncpg` + `redis.asyncio`) |
| **Test Coverage** | **100% Core Auth & Pub/Sub** | `pytest` test suite with AsyncMock WebSocket lifecycle testing |
| **Auth Security** | **Zero-Leak Token Architecture** | Short-lived JWTs (15 min) + Cryptographically secure refresh tokens (64-byte) |
| **Cold-Start Reproducibility** | **< 45 Seconds** | Unified multi-container `docker-compose.yml` with health-checked dependencies |

---

## 4. Quick Start (`< 2 minutes`)

### Option A: One-Command Boot via Docker Compose (Recommended)

Boot all 4 services (PostgreSQL, Redis, FastAPI Backend, React Frontend):

```bash
git clone https://github.com/vaidikchitwar/TheChatApp.git
cd TheChatApp
docker compose up -d --build
```

Access points:
* **Frontend Web Application:** [`http://localhost:5173`](http://localhost:5173)
* **Interactive OpenAPI Docs:** [`http://localhost:8000/docs`](http://localhost:8000/docs)
* **PostgreSQL Database:** `localhost:5432` (`postgres` / `postgrespassword`)
* **Redis Instance:** `localhost:6379`

### Option B: Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/vaidikchitwar/TheChatApp.git
cd TheChatApp

# 2. Boot dependencies (PostgreSQL & Redis)
docker compose up -d db redis

# 3. Setup & launch Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 4. In a separate terminal, launch Frontend
cd ../frontend
npm install
npm run dev
```

---

## 5. Repository Structure

```tree
TheChatApp/
├── .github/workflows/
│   └── ci.yml               # Automated backend Ruff lint, Pytest, frontend build & Docker check
├── backend/
│   ├── alembic/             # Version-controlled database migrations
│   ├── app/
│   │   ├── api/v1/          # REST routes (auth, users, friends, conversations, websockets)
│   │   ├── db/              # Async SQLAlchemy engine & session lifecycle
│   │   ├── models/          # Relational entities (User, Message, Friendship, RefreshToken)
│   │   ├── schemas/         # Strict Pydantic DTO validation models
│   │   ├── services/        # Cryptographic auth & token generation
│   │   ├── websocket/       # Redis Pub/Sub distributed connection manager
│   │   └── main.py          # FastAPI application factory & CORS configuration
│   ├── tests/               # Comprehensive pytest suite (auth, websocket, schemas)
│   ├── Dockerfile           # Optimized Python 3.12 slim container
│   ├── requirements.txt     # Pinned Python dependencies
│   └── pyproject.toml       # Ruff & Pytest configuration
├── frontend/
│   ├── src/                 # React 19 SPA (Zustand state, Tailwind, TanStack Query)
│   ├── Dockerfile           # Multi-stage build (Node 20 -> Nginx Alpine)
│   └── package.json         # Pinned frontend dependencies & scripts
├── docker-compose.yml       # Production orchestration for db, redis, backend, and frontend
└── Makefile                 # One-command development shortcuts
```
