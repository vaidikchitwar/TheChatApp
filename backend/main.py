from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import create_database, get_connection


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


create_database()


class User(BaseModel):
    name: str
    email: str


@app.get("/api/hello")
def hello():
    return {
        "message": "Hello from Hrishi Jain!"
    }


@app.get("/api/users")
def get_users():
    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("SELECT * FROM users")

    users = cursor.fetchall()

    connection.close()

    return [dict(user) for user in users]


@app.post("/api/users")
def create_user(user: User):
    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        (user.name, user.email)
    )

    connection.commit()

    user_id = cursor.lastrowid

    connection.close()

    return {
        "id": user_id,
        "name": user.name,
        "email": user.email
    }