/**
 * Relay P2PManager - Dynamic Mesh WebRTC LAN Version (FINAL FIXED)
 * 
 * Architecture: Full mesh P2P - every peer connects to every other peer
 * No host/participant roles. No hardcoded peer IDs.
 */

class P2PManager {
    constructor() {
        this.peers = new Map();           // peerId -> RTCPeerConnection
        this.dataChannels = new Map();    // peerId -> RTCDataChannel
        
        this.localId = this.generateId(); // Unique ID for this peer
        this.roomId = null;
        this.socket = null;
        
        // Auto-detect WebSocket URL from current page origin
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        this.serverUrl = `${protocol}//${window.location.host}/ws`;
        
        // Callbacks (set by RelayApp)
        this.onMessageCallback = null;
        this.onPeerConnectCallback = null;
        this.onPeerDisconnectCallback = null;
        
        // ICE servers for NAT traversal (STUN only - works on LAN)
        this.iceServers = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" }
            ]
        };
    }

    generateId() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    /* ================= SIGNALING ================= */

    async connect(roomId) {
        this.roomId = roomId;
        
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(this.serverUrl);
            
            this.socket.onopen = () => {
                // Announce ourselves to the signaling server
                this.socket.send(JSON.stringify({
                    type: "join",
                    room: roomId,
                    peerId: this.localId
                }));
                resolve();
            };
            
            this.socket.onmessage = async (event) => {
                try {
                    const signal = JSON.parse(event.data);
                    await this.handleSignal(signal);
                } catch (e) {
                    console.error("Signal parse error:", e);
                }
            };
            
            this.socket.onerror = (err) => {
                console.error("WebSocket error:", err);
                reject(err);
            };
            
            this.socket.onclose = () => {
                console.log("WebSocket closed");
            };
        });
    }

    /* ================= PEER CONNECTION ================= */

    createPeerConnection(peerId) {
        // Don't create duplicate connections
        if (this.peers.has(peerId)) {
            return this.peers.get(peerId);
        }

        const pc = new RTCPeerConnection(this.iceServers);
        
        // Handle ICE candidates
        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.sendSignal({
                    type: "ice",
                    target: peerId,
                    from: this.localId,
                    candidate: e.candidate
                });
            }
        };
        
        // Handle connection state changes (for debugging)
        pc.onconnectionstatechange = () => {
            console.log(`Connection state with ${peerId}:`, pc.connectionState);
        };
        
        // Create data channel (only one side creates, other receives via ondatachannel)
        const channel = pc.createDataChannel("data", { 
            ordered: true,
            maxRetransmits: 3 
        });
        
        this.setupDataChannel(channel, peerId);
        this.peers.set(peerId, pc);
        
        return pc;
    }

    setupDataChannel(channel, peerId) {
        channel.onopen = () => {
            console.log(`✅ Data channel OPEN with ${peerId}`);
            this.dataChannels.set(peerId, channel);
            
            if (this.onPeerConnectCallback) {
                this.onPeerConnectCallback(peerId);
            }
        };
        
        channel.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (this.onMessageCallback) {
                    this.onMessageCallback(peerId, data);
                }
            } catch (err) {
                console.error("Message parse error:", err);
            }
        };
        
        channel.onerror = (err) => {
            console.error(`Data channel error with ${peerId}:`, err);
        };
        
        channel.onclose = () => {
            console.log(`❌ Data channel CLOSED with ${peerId}`);
            this.dataChannels.delete(peerId);
            
            if (this.onPeerDisconnectCallback) {
                this.onPeerDisconnectCallback(peerId);
            }
        };
    }

    // Handle incoming data channel (when we receive, not create)
    handleIncomingDataChannel(event, peerId) {
        const channel = event.channel;
        console.log(`📥 Received data channel from ${peerId}`);
        this.setupDataChannel(channel, peerId);
    }

    /* ================= SIGNAL HANDLING ================= */

    async handleSignal(signal) {
        // Ignore our own signals
        if (signal.from === this.localId || signal.peerId === this.localId) {
            return;
        }

        switch (signal.type) {
            case "peer_joined": {
                // New peer announced by server - initiate handshake if we have lower ID
                const newPeerId = signal.peerId;
                
                // Deterministic rule: lower ID initiates to avoid collision
                if (this.localId < newPeerId) {
                    console.log(`🤝 Initiating handshake with ${newPeerId}`);
                    const pc = this.createPeerConnection(newPeerId);
                    
                    // Handle incoming data channels on this connection
                    pc.ondatachannel = (e) => this.handleIncomingDataChannel(e, newPeerId);
                    
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    
                    this.sendSignal({
                        type: "offer",
                        from: this.localId,
                        target: newPeerId,
                        offer: offer
                    });
                }
                break;
            }

            case "offer": {
                console.log(`📩 Received offer from ${signal.from}`);
                const pc = this.createPeerConnection(signal.from);
                
                // Handle incoming data channels
                pc.ondatachannel = (e) => this.handleIncomingDataChannel(e, signal.from);
                
                await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                this.sendSignal({
                    type: "answer",
                    from: this.localId,
                    target: signal.from,
                    answer: answer
                });
                break;
            }

            case "answer": {
                console.log(`📩 Received answer from ${signal.from}`);
                const pc = this.peers.get(signal.from);
                if (pc && pc.signalingState !== "stable") {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                }
                break;
            }

            case "ice": {
                const pc = this.peers.get(signal.from);
                if (pc) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    } catch (e) {
                        console.warn("ICE candidate error:", e);
                    }
                }
                break;
            }
        }
    }

    /* ================= COMMUNICATION ================= */

    sendSignal(signal) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(signal));
        }
    }

    // Send to all connected peers
    broadcast(data) {
        this.dataChannels.forEach((channel, peerId) => {
            if (channel.readyState === "open") {
                channel.send(JSON.stringify(data));
            }
        });
    }

    // Send to specific peer
    send(peerId, data) {
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === "open") {
            channel.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    // Get count of active data channels (real connected peers)
    getConnectedPeerCount() {
        let count = 0;
        this.dataChannels.forEach(ch => {
            if (ch.readyState === "open") count++;
        });
        return count;
    }

    /* ================= CLEANUP ================= */

    close() {
        console.log("🔌 Closing P2PManager...");
        
        // Close all data channels
        this.dataChannels.forEach((channel, peerId) => {
            if (channel.readyState === "open") {
                channel.close();
            }
        });
        this.dataChannels.clear();
        
        // Close all peer connections
        this.peers.forEach((pc, peerId) => {
            pc.close();
        });
        this.peers.clear();
        
        // Close signaling socket
        if (this.socket) {
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.close();
            }
            this.socket = null;
        }
        
        this.roomId = null;
        console.log("✅ P2PManager closed");
    }

    /* ================= CALLBACKS ================= */

    onMessage(cb) {
        this.onMessageCallback = cb;
    }

    onPeerConnect(cb) {
        this.onPeerConnectCallback = cb;
    }

    onPeerDisconnect(cb) {
        this.onPeerDisconnectCallback = cb;
    }
}
