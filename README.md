# Relay - Offline LAN Collaboration

> Zero-setup P2P tool for classrooms and teams

## Features

- Pure Offline - Works on local network only
- Screen Sharing - Host shares, participants capture slides
- File Sharing - Up to 10MB files
- Quick Polls - Instant feedback
- Shared Notes - Real-time sync
- QR Join - Scan to connect
- Cross-Platform - All devices

## Quick Start

```bash
# 1. Install dependency
pip install aiohttp

# 2. Start server
python3 server.py

# 3. Browser opens at http://YOUR_IP:8000
```

## Usage

**HOST:**
1. Click "Create Room"
2. Share QR code or room code
3. Start sharing screen / files / polls

**PARTICIPANT:**
1. Scan QR OR enter room code
2. View screen, save slides
3. Vote in polls, chat

## Mobile

- Works on phones/tablets
- Landscape mode for slides
- Tap headers to expand sections
- QR scanner uses camera

## Troubleshooting

**Can't join:**
- Use IP shown in terminal (not localhost)
- Check same WiFi
- Allow port 8000 in firewall

**QR not working:**
- Check `lib/qrcode.min.js` exists
- Hard refresh (Ctrl+F5)

**Screen share fails:**
- Chrome/Edge work best
- Allow browser permissions

## Architecture

- Frontend: Vanilla JS
- Backend: Python aiohttp (signaling only)
- P2P: WebRTC full mesh
- Storage: localStorage

## Credits

Made by a backbencher, for backbenchers 🎓
