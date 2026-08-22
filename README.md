# TheChatApp (UCA) Setup Guide

Follow these steps to run the frontend and backend of the application.

---

## Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v20+)
- **Python** (v3.12+)
- **Docker & Docker Compose** (for running PostgreSQL and Redis)

---

## Step 1: Environment Setup

1. Create a `.env` file in the **`backend`** directory with your configuration:
   ```env
   # PostgreSQL
   DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/chatapp
   
   # Redis
   REDIS_URL=redis://localhost:6379/0
   
   # Security
   SECRET_KEY=your_super_secret_key_here
   ALGORITHM=HS256
   
   # Google OAuth (Required for Login)
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   ```

2. Create a `.env` file in the **`frontend`** directory:
   ```env
   VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   ```

---

## Step 2: Start Infrastructure (Docker)

The application requires PostgreSQL and Redis. Start them using Docker Compose:
```bash
docker compose up -d
```

---

## Step 3: Run the Backend (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment (if not already done):
   ```bash
   python3 -m venv .venv
   ```
3. Activate the virtual environment:
   - **macOS/Linux:**
     ```bash
     source .venv/bin/activate
     ```
   - **Windows:**
     ```bash
     .venv\Scripts\activate
     ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Start the backend server:
   ```bash
   alembic upgrade head
   ```
6. Start the backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *The API and interactive docs will be available at `http://localhost:8000/docs`.*

---

## Step 4: Run the Frontend (Vite + React)

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   *The frontend UI will be available at `http://localhost:5173`.*
