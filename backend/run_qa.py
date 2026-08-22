import asyncio
import httpx
import uuid

API_BASE = "http://localhost:8000/api/v1"

async def test_auth_flow(client: httpx.AsyncClient):
    print("Testing Auth Flow...")
    # Register User A
    username_a = f"testa{uuid.uuid4().hex[:8]}"
    res_a = await client.post(f"{API_BASE}/auth/register", json={
        "username": username_a,
        "email": f"{username_a}@test.com",
        "password": "Password123",
        "nickname": "Test User A"
    })
    assert res_a.status_code in [200, 201], f"Register A failed: {res_a.text}"
    
    # Register User B
    username_b = f"testb{uuid.uuid4().hex[:8]}"
    res_b = await client.post(f"{API_BASE}/auth/register", json={
        "username": username_b,
        "email": f"{username_b}@test.com",
        "password": "Password123",
        "nickname": "Test User B"
    })
    assert res_b.status_code in [200, 201], f"Register B failed: {res_b.text}"
    
    # Register User C
    username_c = f"testc{uuid.uuid4().hex[:8]}"
    res_c = await client.post(f"{API_BASE}/auth/register", json={
        "username": username_c,
        "email": f"{username_c}@test.com",
        "password": "Password123",
        "nickname": "Test User C"
    })
    assert res_c.status_code in [200, 201], f"Register C failed: {res_c.text}"

    # Login User A
    login_a = await client.post(f"{API_BASE}/auth/login", data={
        "username": username_a,
        "password": "Password123"
    })
    assert login_a.status_code == 200, f"Login A failed: {login_a.text}"
    token_a = login_a.json()["access_token"]
    
    # Login User B
    login_b = await client.post(f"{API_BASE}/auth/login", data={
        "username": username_b,
        "password": "Password123"
    })
    assert login_b.status_code == 200, f"Login B failed: {login_b.text}"
    token_b = login_b.json()["access_token"]
    
    # Login User C
    login_c = await client.post(f"{API_BASE}/auth/login", data={
        "username": username_c,
        "password": "Password123"
    })
    assert login_c.status_code == 200, f"Login C failed: {login_c.text}"
    token_c = login_c.json()["access_token"]

    return (
        {"username": username_a, "id": res_a.json()["id"], "token": token_a},
        {"username": username_b, "id": res_b.json()["id"], "token": token_b},
        {"username": username_c, "id": res_c.json()["id"], "token": token_c},
    )

async def test_friendship_flow(client, a, b, c):
    print("Testing Friendship Flow...")
    headers_a = {"Authorization": f"Bearer {a['token']}"}
    headers_b = {"Authorization": f"Bearer {b['token']}"}
    headers_c = {"Authorization": f"Bearer {c['token']}"}

    # User A sends request to User B using search
    search_res = await client.get(f"{API_BASE}/users/search?username={b['username']}", headers=headers_a)
    assert search_res.status_code == 200, f"Search failed: {search_res.text}"
    target_id = search_res.json()["id"]

    req_res = await client.post(f"{API_BASE}/friends/request?target_user_id={target_id}", headers=headers_a)
    assert req_res.status_code == 200, f"Friend request failed: {req_res.text}"
    friendship_id = req_res.json()["id"]

    # User B checks pending requests
    pending = await client.get(f"{API_BASE}/friends/pending", headers=headers_b)
    assert pending.status_code == 200
    pending_list = pending.json()
    assert len(pending_list) == 1, "User B should have 1 pending request"
    assert pending_list[0]["id"] == friendship_id

    # User B accepts request
    accept_res = await client.post(f"{API_BASE}/friends/accept?friendship_id={friendship_id}", headers=headers_b)
    assert accept_res.status_code == 200, f"Accept failed: {accept_res.text}"

    # Check User A's friends
    friends_a = await client.get(f"{API_BASE}/friends", headers=headers_a)
    assert len(friends_a.json()) == 1, "User A should have 1 friend"
    assert friends_a.json()[0]["friend"]["username"] == b["username"], "User A's friend should be User B"

    # User C sends request to User A, User A blocks User C
    req_res2 = await client.post(f"{API_BASE}/friends/request?target_user_id={a['id']}", headers=headers_c)
    assert req_res2.status_code == 200

    block_res = await client.post(f"{API_BASE}/friends/block?target_user_id={c['id']}", headers=headers_a)
    assert block_res.status_code == 200, f"Block failed: {block_res.text}"

    # Verify C is blocked and request is deleted
    blocked_list = await client.get(f"{API_BASE}/friends/blocked", headers=headers_a)
    assert len(blocked_list.json()) == 1
    assert blocked_list.json()[0]["friend"]["username"] == c["username"]

    pending_a = await client.get(f"{API_BASE}/friends/pending", headers=headers_a)
    assert len(pending_a.json()) == 0, "Blocked user request should be gone"

async def main():
    async with httpx.AsyncClient() as client:
        a, b, c = await test_auth_flow(client)
        await test_friendship_flow(client, a, b, c)
        print("All API integration tests passed!")

if __name__ == "__main__":
    asyncio.run(main())
