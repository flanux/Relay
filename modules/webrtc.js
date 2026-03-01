/**
 * P2PManager - Fixed WebRTC for LAN
 */
class P2PManager {
    constructor(serverIp = 'localhost') {
        this.peers = new Map();
        this.dataChannels = new Map();
        this.localId = this.generateId();
        this.roomId = null;
        this.isHost = false;
        this.socket = null;
        this.serverUrl = `ws://${serverIp}:8000`; // Matches your Python server
        
        // --- CALLBACK HOLDERS ---
        this.onMessageCallback = null;
        this.onPeerConnectCallback = null;
        this.onPeerDisconnectCallback = null;

        this.iceServers = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };
    }

    generateId() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    // --- CALLBACK SETTERS (These were missing!) ---
    onMessage(callback) { this.onMessageCallback = callback; }
    onPeerConnect(callback) { this.onPeerConnectCallback = callback; }
    onPeerDisconnect(callback) { this.onPeerDisconnectCallback = callback; }

    async initSignaling(roomCode) {
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(this.serverUrl);
            this.socket.onopen = () => {
                this.socket.send(JSON.stringify({ type: 'join', room: roomCode }));
                resolve();
            };
            this.socket.onmessage = (event) => {
                this.handleSignal(JSON.parse(event.data));
            };
            this.socket.onerror = (err) => reject(err);
        });
    }

    async createRoom() {
        this.isHost = true;
        this.roomId = "RELAY-" + Math.floor(1000 + Math.random() * 9000);
        await this.initSignaling(this.roomId);
        return this.roomId;
    }

    async joinRoom(roomCode) {
        this.isHost = false;
        this.roomId = roomCode;
        await this.initSignaling(roomCode);
        await this.connectToPeer('host');
        return true;
    }

    sendSignal(signal) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(signal));
        }
    }

    createPeerConnection(peerId) {
        const pc = new RTCPeerConnection(this.iceServers);
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'ice', target: peerId, from: this.localId, candidate: event.candidate
                });
            }
        };
        pc.ondatachannel = (event) => {
            this.setupDataChannel(event.channel, peerId);
        };
        this.peers.set(peerId, pc);
        return pc;
    }

    setupDataChannel(channel, peerId) {
        channel.onopen = () => {
            this.dataChannels.set(peerId, channel);
            if (this.onPeerConnectCallback) this.onPeerConnectCallback(peerId);
        };
        channel.onmessage = (event) => {
            if (this.onMessageCallback) {
                const data = JSON.parse(event.data);
                this.onMessageCallback(peerId, data);
            }
        };
        channel.onclose = () => {
            this.dataChannels.delete(peerId);
            if (this.onPeerDisconnectCallback) this.onPeerDisconnectCallback(peerId);
        };
    }

    async connectToPeer(peerId) {
        const pc = this.createPeerConnection(peerId);
        const channel = pc.createDataChannel('data');
        this.setupDataChannel(channel, peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.sendSignal({
            type: 'offer', target: peerId, from: this.localId, offer: offer
        });
    }

    async handleSignal(signal) {
        if (signal.type === 'offer' && this.isHost) {
            const pc = this.createPeerConnection(signal.from);
            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.sendSignal({ type: 'answer', target: signal.from, from: this.localId, answer: answer });
        } 
        else if (signal.type === 'answer' && !this.isHost) {
            const pc = this.peers.get('host');
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
        } 
        else if (signal.type === 'ice') {
            const target = this.isHost ? signal.from : 'host';
            const pc = this.peers.get(target);
            if (pc) await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
    }

    // --- COMMUNICATION METHODS ---
    broadcast(data) {
        this.dataChannels.forEach((channel, peerId) => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify(data));
            }
        });
    }

    send(peerId, data) {
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            channel.send(JSON.stringify(data));
        }
    }
}
