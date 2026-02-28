/**
 * WebRTC P2P Manager
 * Handles direct peer-to-peer connections without any server
 * Uses WebRTC DataChannels for file transfer and signaling
 */
class P2PManager {
    constructor() {
        this.peers = new Map(); // Map of peerId -> RTCPeerConnection
        this.dataChannels = new Map(); // Map of peerId -> RTCDataChannel
        this.localId = this.generateId();
        this.roomId = null;
        this.isTeacher = false;
        this.onMessageCallback = null;
        this.onPeerConnectCallback = null;
        this.onPeerDisconnectCallback = null;

        // ICE servers for NAT traversal (STUN only, no TURN needed for LAN)
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        console.log('🔌 P2P Manager initialized, local ID:', this.localId);
    }

    generateId() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    // Generate room code based on local IP + random
    async generateRoomCode() {
        try {
            const ip = await this.getLocalIP();
            const ipPart = ip.split('.')[3] || '000';
            const random = Math.random().toString(36).substring(2, 5).toUpperCase();
            return `${ipPart}-${random}`;
        } catch (e) {
            return `LAN-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        }
    }

    // Get local IP using WebRTC (no external API!)
    getLocalIP() {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');

            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .catch(() => resolve('127.0.0.1'));

            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate || !ice.candidate.candidate) {
                    resolve('127.0.0.1');
                    return;
                }

                const ipMatch = /([0-9]{1,3}\.){3}[0-9]{1,3}/.exec(ice.candidate.candidate);
                resolve(ipMatch ? ipMatch[0] : '127.0.0.1');
                pc.close();
            };

            // Timeout fallback
            setTimeout(() => resolve('127.0.0.1'), 1000);
        });
    }

    // Create room as teacher
    async createRoom() {
        this.isTeacher = true;
        this.roomId = await this.generateRoomCode();

        // Teacher listens for connections via BroadcastChannel (same browser) 
        // and also sets up manual signaling for cross-device
        this.setupSignalingListener();

        console.log('🏫 Room created:', this.roomId);
        return this.roomId;
    }

    // Join room as student
    async joinRoom(roomCode) {
        this.isTeacher = false;
        this.roomId = roomCode;

        // Extract potential IP from room code for LAN discovery
        const targetIP = roomCode.split('-')[0];
        console.log('🎓 Joining room:', roomCode, 'target IP:', targetIP);

        this.setupSignalingListener();

        // Initiate connection to teacher
        await this.initiateConnection('teacher');

        return true;
    }

    setupSignalingListener() {
        // Use BroadcastChannel for same-browser communication
        if (typeof BroadcastChannel !== 'undefined') {
            this.broadcastChannel = new BroadcastChannel('lan-collab-' + this.roomId);
            this.broadcastChannel.onmessage = (event) => {
                this.handleSignalingMessage(event.data);
            };
        }
    }

    // Create peer connection
    createPeerConnection(peerId) {
        const pc = new RTCPeerConnection(this.iceServers);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    target: peerId,
                    candidate: event.candidate,
                    from: this.localId
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`Connection state with ${peerId}:`, pc.connectionState);
            if (pc.connectionState === 'connected') {
                if (this.onPeerConnectCallback) {
                    this.onPeerConnectCallback(peerId);
                }
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                if (this.onPeerDisconnectCallback) {
                    this.onPeerDisconnectCallback(peerId);
                }
                this.peers.delete(peerId);
                this.dataChannels.delete(peerId);
            }
        };

        this.peers.set(peerId, pc);
        return pc;
    }

    // Create data channel for a peer
    createDataChannel(peerId, pc) {
        const channel = pc.createDataChannel('data', {
            ordered: true,
            maxRetransmits: 3
        });

        this.setupDataChannel(channel, peerId);
        return channel;
    }

    setupDataChannel(channel, peerId) {
        channel.onopen = () => {
            console.log('✅ Data channel open with:', peerId);
        };

        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (this.onMessageCallback) {
                    this.onMessageCallback(peerId, data);
                }
            } catch (e) {
                // Handle binary data (files)
                if (this.onMessageCallback) {
                    this.onMessageCallback(peerId, { type: 'binary', data: event.data });
                }
            }
        };

        channel.onclose = () => {
            console.log('❌ Data channel closed:', peerId);
        };

        this.dataChannels.set(peerId, channel);
    }

    // Initiate connection (student calls this)
    async initiateConnection(peerId) {
        const pc = this.createPeerConnection(peerId);
        const channel = this.createDataChannel(peerId, pc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.sendSignalingMessage({
            type: 'offer',
            target: peerId,
            offer: offer,
            from: this.localId,
            isTeacher: this.isTeacher
        });
    }

    // Handle incoming signaling messages
    async handleSignalingMessage(message) {
        if (message.target && message.target !== this.localId && message.target !== 'broadcast') {
            return; // Not for us
        }

        switch (message.type) {
            case 'offer':
                await this.handleOffer(message.from, message.offer, message.isTeacher);
                break;
            case 'answer':
                await this.handleAnswer(message.from, message.answer);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(message.from, message.candidate);
                break;
            case 'broadcast':
                // Handle broadcast messages
                if (this.onMessageCallback) {
                    this.onMessageCallback(message.from, message.data);
                }
                break;
        }
    }

    async handleOffer(from, offer, isTeacher) {
        const pc = this.createPeerConnection(from);

        pc.ondatachannel = (event) => {
            this.setupDataChannel(event.channel, from);
        };

        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.sendSignalingMessage({
            type: 'answer',
            target: from,
            answer: answer,
            from: this.localId
        });
    }

    async handleAnswer(from, answer) {
        const pc = this.peers.get(from);
        if (pc) {
            await pc.setRemoteDescription(answer);
        }
    }

    async handleIceCandidate(from, candidate) {
        const pc = this.peers.get(from);
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }

    // Send signaling message via BroadcastChannel or manual method
    sendSignalingMessage(message) {
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(message);
        }

        // Also emit event for manual signaling (QR code, etc.)
        window.dispatchEvent(new CustomEvent('signaling-message', { detail: message }));
    }

    // Send data to specific peer
    sendTo(peerId, data) {
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            channel.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    // Broadcast to all peers
    broadcast(data) {
        let sent = 0;
        this.dataChannels.forEach((channel, peerId) => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify(data));
                sent++;
            }
        });
        return sent;
    }

    // Send file in chunks
    async sendFile(peerId, file, onProgress) {
        const channel = this.dataChannels.get(peerId);
        if (!channel || channel.readyState !== 'open') {
            throw new Error('Data channel not open');
        }

        const chunkSize = 16384; // 16KB chunks
        const buffer = await file.arrayBuffer();
        const totalChunks = Math.ceil(buffer.byteLength / chunkSize);

        // Send metadata first
        channel.send(JSON.stringify({
            type: 'file-start',
            fileId: Math.random().toString(36).substring(2),
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            totalChunks: totalChunks
        }));

        // Send chunks
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, buffer.byteLength);
            const chunk = buffer.slice(start, end);

            // Convert to blob for sending
            const blob = new Blob([chunk]);
            const reader = new FileReader();

            await new Promise((resolve) => {
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    channel.send(JSON.stringify({
                        type: 'file-chunk',
                        index: i,
                        data: base64
                    }));

                    if (onProgress) {
                        onProgress((i + 1) / totalChunks);
                    }
                    resolve();
                };
                reader.readAsDataURL(blob);
            });

            // Small delay to prevent flooding
            await new Promise(r => setTimeout(r, 10));
        }

        // Send completion
        channel.send(JSON.stringify({
            type: 'file-end'
        }));
    }

    // Set callbacks
    onMessage(callback) {
        this.onMessageCallback = callback;
    }

    onPeerConnect(callback) {
        this.onPeerConnectCallback = callback;
    }

    onPeerDisconnect(callback) {
        this.onPeerDisconnectCallback = callback;
    }

    // Get connection stats
    getStats() {
        return {
            peers: this.peers.size,
            channels: this.dataChannels.size,
            localId: this.localId,
            roomId: this.roomId,
            isTeacher: this.isTeacher
        };
    }

    // Close all connections
    close() {
        this.dataChannels.forEach(channel => channel.close());
        this.peers.forEach(pc => pc.close());
        this.dataChannels.clear();
        this.peers.clear();

        if (this.broadcastChannel) {
            this.broadcastChannel.close();
        }
    }
}

// Export
window.P2PManager = P2PManager;