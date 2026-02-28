/**
 * P2PManager - WebRTC based peer-to-peer communication
 * Simplified for LAN use with BroadcastChannel signaling
 */
class P2PManager {
    constructor() {
        this.peers = new Map();
        this.dataChannels = new Map();
        this.localId = this.generateId();
        this.roomId = null;
        this.isHost = false;
        this.broadcastChannel = null;
        
        // Callbacks
        this.onMessageCallback = null;
        this.onPeerConnectCallback = null;
        this.onPeerDisconnectCallback = null;

        // Simple STUN servers for NAT traversal
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };

        console.log('🔌 P2P Manager initialized:', this.localId);
    }

    generateId() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    async generateRoomCode() {
        // Generate room code: IP-last-octet + random string
        try {
            const ip = await this.getLocalIP();
            const ipPart = ip.split('.').pop() || Math.floor(Math.random() * 256);
            const random = Math.random().toString(36).substring(2, 5).toUpperCase();
            return `${ipPart}-${random}`;
        } catch (e) {
            const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
            return rand;
        }
    }

    async getLocalIP() {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .catch(() => resolve('192.168.1.100'));

            pc.onicecandidate = (event) => {
                if (!event || !event.candidate) {
                    resolve('192.168.1.100');
                    return;
                }

                const candidate = event.candidate.candidate;
                const ipMatch = /([0-9]{1,3}\.){3}[0-9]{1,3}/.exec(candidate);
                
                if (ipMatch) {
                    resolve(ipMatch[0]);
                    pc.close();
                }
            };

            setTimeout(() => resolve('192.168.1.100'), 1000);
        });
    }

    async createRoom() {
        this.isHost = true;
        this.roomId = await this.generateRoomCode();
        this.setupSignaling();
        console.log('🏠 Room created:', this.roomId);
        return this.roomId;
    }

    async joinRoom(roomCode) {
        this.isHost = false;
        this.roomId = roomCode;
        this.setupSignaling();
        
        // Initiate connection to host
        await this.connectToPeer('host');
        
        console.log('👥 Joining room:', roomCode);
        return true;
    }

    setupSignaling() {
        if (typeof BroadcastChannel !== 'undefined') {
            this.broadcastChannel = new BroadcastChannel('relay_' + this.roomId);
            this.broadcastChannel.onmessage = (event) => {
                this.handleSignal(event.data);
            };
        }
    }

    sendSignal(signal) {
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(signal);
        }
    }

    createPeerConnection(peerId) {
        const pc = new RTCPeerConnection(this.iceServers);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'ice',
                    target: peerId,
                    from: this.localId,
                    candidate: event.candidate
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`Connection state [${peerId}]:`, pc.connectionState);
            
            if (pc.connectionState === 'connected') {
                this.onPeerConnectCallback && this.onPeerConnectCallback(peerId);
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.handlePeerDisconnect(peerId);
            }
        };

        pc.ondatachannel = (event) => {
            this.setupDataChannel(event.channel, peerId);
        };

        this.peers.set(peerId, pc);
        return pc;
    }

    setupDataChannel(channel, peerId) {
        channel.binaryType = 'arraybuffer';

        channel.onopen = () => {
            console.log('✅ Data channel open:', peerId);
            this.dataChannels.set(peerId, channel);
        };

        channel.onmessage = (event) => {
            if (this.onMessageCallback) {
                try {
                    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                    this.onMessageCallback(peerId, data);
                } catch (e) {
                    this.onMessageCallback(peerId, event.data);
                }
            }
        };

        channel.onclose = () => {
            console.log('❌ Channel closed:', peerId);
            this.dataChannels.delete(peerId);
        };

        this.dataChannels.set(peerId, channel);
    }

    async connectToPeer(peerId) {
        const pc = this.createPeerConnection(peerId);
        const channel = pc.createDataChannel('data', {
            ordered: true
        });
        
        this.setupDataChannel(channel, peerId);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.sendSignal({
            type: 'offer',
            target: peerId,
            from: this.localId,
            offer: offer,
            isHost: this.isHost
        });
    }

    async handleSignal(signal) {
        // Ignore messages not for us
        if (signal.target && signal.target !== this.localId && signal.target !== 'host' && signal.target !== 'broadcast') {
            return;
        }

        // Host receives offers, participants receive answers
        if (this.isHost && signal.target === 'host') {
            // Ignore
        } else if (!this.isHost && signal.target !== this.localId) {
            return;
        }

        try {
            if (signal.type === 'offer') {
                await this.handleOffer(signal);
            } else if (signal.type === 'answer') {
                await this.handleAnswer(signal);
            } else if (signal.type === 'ice') {
                await this.handleICE(signal);
            }
        } catch (error) {
            console.error('Signal handling error:', error);
        }
    }

    async handleOffer(signal) {
        const pc = this.createPeerConnection(signal.from);
        
        await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.sendSignal({
            type: 'answer',
            target: signal.from,
            from: this.localId,
            answer: answer
        });
    }

    async handleAnswer(signal) {
        const pc = this.peers.get(signal.from);
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
        }
    }

    async handleICE(signal) {
        const pc = this.peers.get(signal.from);
        if (pc && signal.candidate) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }

    handlePeerDisconnect(peerId) {
        this.peers.delete(peerId);
        this.dataChannels.delete(peerId);
        this.onPeerDisconnectCallback && this.onPeerDisconnectCallback(peerId);
    }

    send(peerId, data) {
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            channel.send(message);
            return true;
        }
        return false;
    }

    broadcast(data) {
        let sent = 0;
        this.dataChannels.forEach((channel, peerId) => {
            if (this.send(peerId, data)) {
                sent++;
            }
        });
        return sent;
    }

    getPeerCount() {
        return this.dataChannels.size;
    }

    getPeerIds() {
        return Array.from(this.dataChannels.keys());
    }

    onMessage(callback) {
        this.onMessageCallback = callback;
    }

    onPeerConnect(callback) {
        this.onPeerConnectCallback = callback;
    }

    onPeerDisconnect(callback) {
        this.onPeerDisconnectCallback = callback;
    }

    close() {
        this.peers.forEach(pc => pc.close());
        this.peers.clear();
        this.dataChannels.clear();
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
        }
    }
}

// Export
window.P2PManager = P2PManager;
