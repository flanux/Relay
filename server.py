import asyncio
import websockets
import json
import socket

# --- Helper to find your actual LAN IP ---
def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('8.8.8.8', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

rooms = {}

async def handler(websocket):
    current_room = None
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get('type') == 'join':
                current_room = data.get('room')
                if current_room not in rooms: rooms[current_room] = set()
                rooms[current_room].add(websocket)
                print(f"📡 Peer joined room: {current_room}")
                continue

            if current_room in rooms:
                for client in rooms[current_room]:
                    if client != websocket:
                        await client.send(json.dumps(data))
    except:
        pass
    finally:
        if current_room in rooms and websocket in rooms[current_room]:
            rooms[current_room].remove(websocket)

async def main():
    hostname = get_lan_ip()
    port = 8000
    async with websockets.serve(handler, "0.0.0.0", port):
        print("--- RELAY SERVER STARTED ---")
        print(f"🏠 Local IP: {hostname}")
        print(f"📱 On your phone, connect to: http://{hostname}:5500") # Assuming you use Live Server
        print(f"🔗 Signaling URL: ws://{hostname}:{port}")
        print("----------------------------")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
