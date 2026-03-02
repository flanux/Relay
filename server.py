import socket
import webbrowser
import json
from aiohttp import web

# -----------------------------
# LAN IP DETECTION
# -----------------------------

def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except:
        return "127.0.0.1"
    finally:
        s.close()

# -----------------------------
# ROOM STORAGE
# -----------------------------

rooms = {}

# -----------------------------
# INDEX PAGE
# -----------------------------

async def index(request):
    return web.FileResponse("index.html")

# -----------------------------
# WEBSOCKET SIGNALING
# -----------------------------

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    current_room = None

    try:
        async for msg in ws:
            data = json.loads(msg.data)

            if data.get("type") == "join":
                current_room = data["room"]
                rooms.setdefault(current_room, set()).add(ws)
                continue

            # Relay signaling messages only
            if current_room in rooms:
                for client in rooms[current_room]:
                    if client != ws:
                        await client.send_json(data)

    finally:
        if current_room and current_room in rooms:
            rooms[current_room].discard(ws)

    return ws

# -----------------------------
# SERVER SETUP
# -----------------------------

app = web.Application()

app.router.add_get("/", index)
app.router.add_get("/ws", websocket_handler)
app.router.add_static("/static/", ".", show_index=False)

# -----------------------------
# START SERVER
# -----------------------------

ip = get_lan_ip()
url = f"http://{ip}:8000"

print("\n🚀 RELAY SERVER READY")
print("================================")
print(f"Open this in browser (HOST ONLY):")
print(url)
print("================================\n")

# Auto open browser for host
webbrowser.open(url)

web.run_app(app, host="0.0.0.0", port=8000)
