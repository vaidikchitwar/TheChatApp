# TheChatApp (UCA) Setup Guide

Follow these steps to run the frontend and backend of the application.

---

## Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v18+)
- **Python** (v3.10+)

---

## Step 1: Run the Backend (FastAPI)

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
   uvicorn main:app --reload --port 8000
   ```
   *The API will be available at `http://localhost:8000`.*

---

## Step 2: Run the Frontend (Vite + React)

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
