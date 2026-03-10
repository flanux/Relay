import socket
import webbrowser
import json
import re
import subprocess
import sys
from aiohttp import web

# -----------------------------
# LAN IP DETECTION (Windows-aware)
# -----------------------------

def get_lan_ips():
    """
    Return a deduplicated, priority-sorted list of LAN IPv4 addresses.

    Discovery order:
      1. Windows `ipconfig` — skips virtual / VPN adapters
      2. Hostname DNS resolution  (cross-platform fallback)
      3. UDP-socket trick         (last resort)

    Subnet priority: 192.168.x.x > 10.x.x.x > 172.16-31.x.x > other
    """
    candidates = []

    # --- Method 1 : Windows ipconfig ---
    if sys.platform == "win32":
        try:
            output = subprocess.check_output(
                ["ipconfig"],
                text=True,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            # Split output into per-adapter blocks (each block starts at col 0)
            blocks = re.split(r"(?:\r?\n)(?=\S)", output)
            SKIP = ("vmware", "virtualbox", "vbox", "vpn", "loopback",
                    "pseudo", "teredo", "isatap", "bluetooth", "tunnel",
                    "6to4", "miniport", "hyper-v")
            for block in blocks:
                header = block[:120].lower()
                if any(k in header for k in SKIP):
                    continue
                for ip in re.findall(
                    r"IPv4 Address[\. ]+:\s*(\d{1,3}(?:\.\d{1,3}){3})", block
                ):
                    if not ip.startswith(("127.", "169.254.")):
                        candidates.append(ip)
        except Exception:
            pass

    # --- Method 2 : Hostname resolution ---
    try:
        hostname = socket.gethostname()
        for res in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = res[4][0]
            if not ip.startswith(("127.", "169.254.")):
                candidates.append(ip)
    except Exception:
        pass

    # --- Method 3 : UDP-socket trick (original fallback) ---
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            candidates.append(s.getsockname()[0])
        finally:
            s.close()
    except Exception:
        pass

    # Deduplicate, preserve discovery order, then sort by subnet preference
    seen: set = set()
    unique = [ip for ip in candidates if ip not in seen and not seen.add(ip)]  # type: ignore[func-returns-value]

    def _score(ip: str) -> int:
        if ip.startswith("192.168."):
            return 0
        if ip.startswith("10."):
            return 1
        if re.match(r"^172\.(1[6-9]|2\d|3[01])\.", ip):
            return 2
        return 3

    unique.sort(key=_score)
    return unique or ["127.0.0.1"]


def get_lan_ip() -> str:
    """Return the single best LAN IP (first result from get_lan_ips)."""
    return get_lan_ips()[0]

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

all_ips = get_lan_ips()
ip = all_ips[0]          # best candidate (used for QR)
localhost_url = "http://localhost:8000"
lan_url = f"http://{ip}:8000"

print("\n🚀 RELAY SERVER READY")
print("=" * 60)
print(f"✅ HOST (Teacher): Open browser at:")
print(f"   {localhost_url}")
print(f"")
print(f"📱 PARTICIPANTS (Students): Connect via QR or use:")
print(f"   {lan_url}  ← used for QR code")
if len(all_ips) > 1:
    print(f"")
    print(f"🔎 All detected LAN interfaces:")
    for idx, addr in enumerate(all_ips):
        marker = "  ← selected" if idx == 0 else ""
        print(f"   http://{addr}:8000{marker}")
print("=" * 60)
print("")
print("💡 Host MUST use localhost for screen sharing to work!")
print("💡 Participants can use the IP address (it's fine for them)")
print("")

# Auto open browser for host with localhost
webbrowser.open(f"http://localhost:8000?ip={ip}")

web.run_app(app, host="0.0.0.0", port=8000)
