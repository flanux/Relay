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
                peer_id = data.get("peerId")  # Client sends this
                
                # Store room + peer mapping
                rooms.setdefault(current_room, {}).setdefault(peer_id, ws)
                
                # 🔥 Notify ALL existing peers: "new peer joined"
                for existing_id, existing_ws in rooms[current_room].items():
                    if existing_id != peer_id:
                        await existing_ws.send_json({
                            "type": "peer_joined",
                            "peerId": peer_id
                        })
                
                # 🔥 Notify NEW peer: "here are existing peers"
                for existing_id in rooms[current_room]:
                    if existing_id != peer_id:
                        await ws.send_json({
                            "type": "peer_joined", 
                            "peerId": existing_id
                        })
                continue
            
            # Relay other signaling messages
            if current_room and current_room in rooms:
                target = data.get("target")
                if target and target in rooms[current_room]:
                    await rooms[current_room][target].send_json(data)
                else:
                    # Broadcast to all in room (for mesh)
                    for peer_id, peer_ws in rooms[current_room].items():
                        if peer_ws != ws:
                            await peer_ws.send_json(data)
                            
    finally:
        # Cleanup on disconnect
        if current_room and current_room in rooms:
            for peer_id, peer_ws in list(rooms[current_room].items()):
                if peer_ws == ws:
                    del rooms[current_room][peer_id]
                    break
            if not rooms[current_room]:
                del rooms[current_room]
    
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
localhost_url = "http://localhost:8000"
lan_url = f"http://{ip}:8000"

print("\n🚀 RELAY SERVER READY")
print("=" * 60)
print(f"✅ HOST (Teacher): Open browser at:")
print(f"   {localhost_url}")
print(f"")
print(f"📱 PARTICIPANTS (Students): Connect via QR or use:")
print(f"   {lan_url}")
print("=" * 60)
print("")
print("💡 Host MUST use localhost for screen sharing to work!")
print("💡 Participants can use the IP address (it's fine for them)")
print("")

# Auto open browser for host with localhost
webbrowser.open(localhost_url)

web.run_app(app, host="0.0.0.0", port=8000)
