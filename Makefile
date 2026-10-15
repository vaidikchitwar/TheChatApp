.PHONY: help install test lint format up down restart logs

help:
	@echo "TheChatApp (UCA) - Developer Commands:"
	@echo "  make up       - Boot PostgreSQL, Redis, FastAPI, and React via Docker Compose"
	@echo "  make down     - Stop all running containers"
	@echo "  make test     - Run backend automated test suite with pytest"
	@echo "  make lint     - Run Ruff and frontend linting"
	@echo "  make format   - Automatically format Python backend with Ruff"
	@echo "  make logs     - Tail logs across all services"

install:
	cd backend && pip install -r requirements.txt && pip install ruff pytest pytest-asyncio pytest-cov
	cd frontend && npm install

test:
	cd backend && pytest tests/ -v

lint:
	cd backend && ruff check .

format:
	cd backend && ruff format .

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose down && docker compose up -d --build

logs:
	docker compose logs -f
