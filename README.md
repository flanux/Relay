# Relay - LAN Collaboration Hub

> Zero-setup P2P collaboration tool for local networks

Relay is a lightweight, browser-based collaboration platform that works entirely over your local network without requiring any internet connection or server setup. Perfect for classrooms, meetings, workshops, and offline collaboration.

## ✨ Features

### 🏠 Host Mode
- **Create rooms instantly** with auto-generated codes
- **Screen sharing** with live streaming to all participants
- **File sharing** up to 10MB per file
- **Quick polls** with real-time results
- **Shared notes** that sync to all participants
- **QR code generation** for easy joining

### 👥 Participant Mode
- **Live screen viewing** with minimal latency
- **Auto-capture slides** or save manually
- **Gallery view** of all captured slides
- **Download all slides** as images
- **Vote on polls** with instant feedback
- **View shared notes** in real-time
- **Group chat** with all participants

## 🚀 Quick Start

### Setup

1. **Download** the complete Relay folder
2. **Open** `index.html` in any modern browser
3. That's it! No installation required.

### Create a Room (Host)

1. Click **"Create Room (Host)"**
2. Share the room code with participants
3. Start screen sharing when ready
4. Share files, create polls, write notes

### Join a Room (Participant)

1. Get the room code from the host
2. Enter your name and the room code
3. Click **"Join as Participant"**
4. View the shared screen and interact

## 📋 System Requirements

- **Browser**: Chrome 90+, Edge 90+, Firefox 88+, Safari 14+
- **Network**: Same local network (WiFi/Ethernet)
- **Permissions**: Camera/Screen sharing permission for hosts

## 🎯 Use Cases

### Education
- Live lecture streaming to student devices
- Students can capture slides automatically
- Quick polls for comprehension checks
- Share PDFs, presentations, and documents

### Meetings
- Present slides without HDMI cables
- Participants can save important slides
- Real-time polls for decision making
- Shared meeting notes

### Workshops
- Share screen with all attendees
- Distribute files instantly
- Gather feedback via polls
- Collaborative note-taking

## 🔧 Technical Details

### Architecture
- **P2P Communication**: WebRTC DataChannels for direct peer-to-peer connections
- **Signaling**: BroadcastChannel API for same-network discovery
- **Storage**: LocalStorage for offline slide persistence
- **Screen Capture**: MediaDevices.getDisplayMedia API

### Network Requirements
- All devices must be on the **same local network**
- No firewall blocking WebRTC connections
- UDP ports open for STUN (uses Google's STUN servers for NAT traversal)

### Browser APIs Used
- WebRTC (RTCPeerConnection, RTCDataChannel)
- BroadcastChannel API
- MediaDevices API (getDisplayMedia)
- LocalStorage API
- Canvas API (for slide capture)

## 🎨 Features Breakdown

### Screen Sharing
- **Frame Rate**: 2 FPS (optimized for slides)
- **Quality**: JPEG compression at 70%
- **Resolution**: Full screen resolution
- **Format**: Base64-encoded images

### File Sharing
- **Max Size**: 10MB per file
- **Transfer**: Direct P2P via WebRTC DataChannels
- **Supported**: All file types

### Polls
- **Options**: 2-6 options per poll
- **Real-time**: Instant vote updates
- **Visual**: Bar charts with percentages
- **Anonymous**: Votes are not attributed to individuals

### Notes
- **Sync**: Real-time synchronization
- **Edit**: Host can edit, participants read-only
- **Storage**: Saved locally on all devices
- **Format**: Plain text

## 📱 Mobile Support

Relay works on mobile devices with some limitations:
- **Joining rooms**: ✅ Full support
- **Viewing shared screen**: ✅ Full support
- **Saving slides**: ✅ Full support
- **Chat and polls**: ✅ Full support
- **Screen sharing**: ❌ Not supported (browser limitation)

## 🔒 Security & Privacy

### Data Security
- **No server**: All data stays on your local network
- **No cloud**: Nothing is uploaded to the internet
- **No tracking**: Zero analytics or tracking
- **No accounts**: No sign-up or authentication required

### Privacy
- **Ephemeral**: Rooms disappear when closed
- **Local storage**: Saved data only on your device
- **No logs**: No connection logs or history
- **Peer-to-peer**: Direct connections only

## 🐛 Troubleshooting

### Can't join room
- ✓ Check if you're on the same network as the host
- ✓ Make sure the room code is correct
- ✓ Verify WebRTC is not blocked by firewall
- ✓ Try refreshing the page

### Screen sharing not working
- ✓ Grant screen share permission when prompted
- ✓ Ensure you're using a supported browser
- ✓ Check if another app is already capturing the screen
- ✓ Try selecting a different screen/window

### Participants can't see screen
- ✓ Make sure screen sharing is started
- ✓ Check if participants are still connected
- ✓ Verify network connection is stable
- ✓ Try stopping and restarting screen share

### Poor video quality
- ✓ This is normal - Relay optimizes for slides, not video
- ✓ Frame rate is intentionally low (2 FPS)
- ✓ For better quality, use auto-capture and view saved slides

## 🤝 Contributing

Relay is open-source. Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Fork and modify for your needs

## 📝 License

MIT License - Free to use, modify, and distribute.

## 🎓 Credits

Built with:
- WebRTC for P2P communication
- QRCode.js for QR code generation
- Modern CSS for beautiful UI
- Vanilla JavaScript (no frameworks!)

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Ensure all system requirements are met

---

**Relay** - Made for collaboration, built for privacy.
