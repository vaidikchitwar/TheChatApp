import asyncio
import httpx
import websockets
import json
import subprocess
import time
import os
import signal

async def test_pubsub():
    print("Starting uvicorn instances on ports 8001 and 8002...")
    env = os.environ.copy()
    p1 = subprocess.Popen(["uvicorn", "app.main:app", "--port", "8001"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    p2 = subprocess.Popen(["uvicorn", "app.main:app", "--port", "8002"], env=env)
    
    try:
        # Wait for them to boot
        time.sleep(3)
        
        async with httpx.AsyncClient() as client:
            # Register User 1
            res1 = await client.post("http://127.0.0.1:8001/api/v1/auth/register", json={
                "email": "user1@test.com", "username": "user1", "nickname": "User 1", "password": "Password123"
            })
            if res1.status_code not in (200, 201, 400): # 400 if already exists
                print("Failed to register User 1:", res1.text)
                return
            
            # Login User 1
            res1_log = await client.post("http://127.0.0.1:8001/api/v1/auth/login", data={"username": "user1@test.com", "password": "Password123"})
            token1 = res1_log.json()["access_token"]
            
            # Register User 2
            res2 = await client.post("http://127.0.0.1:8002/api/v1/auth/register", json={
                "email": "user2@test.com", "username": "user2", "nickname": "User 2", "password": "Password123"
            })
            
            # Login User 2
            res2_log = await client.post("http://127.0.0.1:8002/api/v1/auth/login", data={"username": "user2@test.com", "password": "Password123"})
            token2 = res2_log.json()["access_token"]
            
            res2_me = await client.get("http://127.0.0.1:8002/api/v1/auth/me", headers={"Authorization": f"Bearer {token2}"})
            user2_id = res2_me.json()["id"]
            
            # User 1 creates conversation with User 2
            headers1 = {"Authorization": f"Bearer {token1}"}
            conv_res = await client.post(f"http://127.0.0.1:8001/api/v1/conversations?target_user_id={user2_id}", headers=headers1)
            conv_id = conv_res.json()["id"]
            
        print(f"Created conversation {conv_id} between users")
        
        # Connect WS
        async def user2_listen():
            uri = f"ws://127.0.0.1:8002/api/v1/websockets/ws/{token2}"
            async with websockets.connect(uri) as ws:
                while True:
                    msg = await ws.recv()
                    data = json.loads(msg)
                    if data["type"] == "NEW_MESSAGE" and data.get("message", {}).get("content") == "Hello from User 1!":
                        print("✅ User 2 received message successfully via Redis Pub/Sub!")
                        return True
        
        async def user1_send():
            uri = f"ws://127.0.0.1:8001/api/v1/websockets/ws/{token1}"
            async with websockets.connect(uri) as ws:
                await asyncio.sleep(1) # wait for user2 to connect
                payload = {
                    "type": "NEW_MESSAGE",
                    "conversation_id": conv_id,
                    "content": "Hello from User 1!",
                    "client_message_id": "test-id-12345"
                }
                await ws.send(json.dumps(payload))
                print("User 1 sent message.")
                # wait for ACK
                ack = await ws.recv()
                print("User 1 received ACK:", ack)
                
        # Run both
        t1 = asyncio.create_task(user2_listen())
        t2 = asyncio.create_task(user1_send())
        
        await asyncio.wait_for(t1, timeout=5.0)
        await t2
        
        print("\n🎉 MULTI-INSTANCE PUB/SUB ROUTING VERIFIED SUCCESSFULLY 🎉\n")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("❌ Test failed:", e)
    finally:
        p1.terminate()
        p2.terminate()

asyncio.run(test_pubsub())
