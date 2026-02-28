/**
 * Relay - Main Application
 * Zero-setup P2P collaboration tool
 */
class App {
    constructor() {
        this.p2p = null;
        this.storage = null;
        this.slideSync = null;
        this.pollManager = null;
        this.currentRoom = null;
        this.username = '';
        this.isTeacher = false;

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('🚀 Initializing LAN Collab Hub...');

        // Initialize storage
        this.storage = new SmartStorage();

        // Setup drag and drop
        this.setupDragAndDrop();

        // Setup beforeunload warning
        window.addEventListener('beforeunload', (e) => {
            if (this.currentRoom) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        console.log('✓ App initialized');
    }

    // Create room as teacher
    async createRoom() {
        try {
            // Initialize P2P
            this.p2p = new P2PManager();
            const roomCode = await this.p2p.createRoom();

            this.isTeacher = true;
            this.username = 'Teacher';
            this.currentRoom = roomCode;

            // Initialize features
            this.slideSync = new SlideSync(this.p2p);
            this.pollManager = new PollManager(this.p2p);

            // Setup message handling
            this.setupMessageHandling();

            // Save room to storage
            await this.storage.saveRoom(roomCode, {
                createdBy: this.username,
                createdAt: Date.now()
            });

            // Switch to teacher view
            this.showView('teacher-room');
            document.getElementById('displayRoomCode').textContent = roomCode;

            this.showNotification(`Room created! Code: ${roomCode}`, 'success');

            // Copy code to clipboard
            await navigator.clipboard.writeText(roomCode);
            this.showNotification('Room code copied to clipboard!', 'info');

        } catch (err) {
            console.error('Failed to create room:', err);
            this.showNotification('Failed to create room', 'error');
        }
    }

    // Join room as student
    async joinRoom() {
        const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
        const username = document.getElementById('username').value.trim() || 'Anonymous';

        if (!roomCode) {
            this.showNotification('Please enter a room code', 'error');
            return;
        }

        try {
            this.p2p = new P2PManager();
            await this.p2p.joinRoom(roomCode);

            this.isTeacher = false;
            this.username = username;
            this.currentRoom = roomCode;

            // Initialize features
            this.slideSync = new SlideSync(this.p2p);
            this.pollManager = new PollManager(this.p2p);

            // Setup message handling
            this.setupMessageHandling();

            // Load saved slides
            await this.slideSync.loadSavedSlides();

            // Switch to student view
            this.showView('student-room');
            document.getElementById('studentRoomCode').textContent = roomCode;
            document.getElementById('studentNameDisplay').textContent = username;

            this.showNotification(`Joined room ${roomCode}!`, 'success');

        } catch (err) {
            console.error('Failed to join room:', err);
            this.showNotification('Failed to join room', 'error');
        }
    }

    // Setup P2P message handling
    setupMessageHandling() {
        this.p2p.onPeerConnect((peerId) => {
            console.log('✅ Peer connected:', peerId);
            this.showNotification('New participant joined', 'success');
            this.updateParticipantCount();
        });

        this.p2p.onPeerDisconnect((peerId) => {
            console.log('❌ Peer disconnected:', peerId);
            this.updateParticipantCount();
        });

        this.p2p.onMessage((peerId, data) => {
            this.handleMessage(peerId, data);
        });
    }

    // Handle incoming messages
    handleMessage(peerId, data) {
        switch (data.type) {
            case 'chat':
                this.displayChatMessage(data.username, data.message);
                break;
            case 'file-offer':
                this.handleFileOffer(peerId, data);
                break;
            case 'user-joined':
                this.updateParticipantCount();
                break;
        }
    }

    // Toggle projector sync
    async toggleProjectorSync() {
        if (!this.slideSync) return;

        const btn = document.getElementById('syncBtn');

        if (this.slideSync.isCapturing) {
            this.slideSync.stopCapture();
            btn.textContent = 'Start Sharing';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-primary');
        } else {
            const success = await this.slideSync.startCapture();
            if (success) {
                btn.textContent = 'Stop Sharing';
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-danger');
            }
        }
    }

    // Poll management
    addPollOption() {
        const container = document.getElementById('pollOptions');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'poll-option';
        input.placeholder = `Option ${container.children.length + 1}`;
        container.appendChild(input);
    }

    createPoll() {
        const question = document.getElementById('pollQuestion').value.trim();
        const optionInputs = document.querySelectorAll('.poll-option');
        const options = Array.from(optionInputs).map(input => input.value.trim()).filter(v => v);

        if (!question || options.length < 2) {
            this.showNotification('Please enter a question and at least 2 options', 'error');
            return;
        }

        this.pollManager.createPoll(question, options);
        this.showNotification('Poll started!', 'success');
    }

    closePoll() {
        this.pollManager.closePoll();
    }

    vote(pollId, optionIndex) {
        this.pollManager.submitVote(pollId, optionIndex, this.username);
    }

    // File handling
    setupDragAndDrop() {
        const dropZone = document.getElementById('dropZone');
        if (!dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            this.handleFiles(e.dataTransfer.files);
        });
    }

    async handleFiles(files) {
        if (!files.length) return;

        for (const file of files) {
            await this.shareFile(file);
        }
    }

    async shareFile(file) {
        try {
            // Save to storage
            const fileId = Math.random().toString(36).substring(2);
            await this.storage.saveFile(fileId, this.currentRoom, file, {
                name: file.name,
                size: file.size,
                type: file.type,
                sharedBy: this.username,
                sharedAt: Date.now()
            });

            // Send to peers
            this.p2p.broadcast({
                type: 'file-offer',
                fileId: fileId,
                metadata: {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    sharedBy: this.username
                }
            });

            // Update UI
            this.addFileToList(file.name, file.size, this.username);
            this.showNotification(`Shared: ${file.name}`, 'success');

        } catch (err) {
            console.error('Failed to share file:', err);
            this.showNotification('Failed to share file', 'error');
        }
    }

    addFileToList(name, size, sharedBy) {
        const list = document.getElementById(this.isTeacher ? 'fileList' : 'studentFileList');
        if (!list) return;

        // Remove empty state
        const empty = list.querySelector('.empty');
        if (empty) empty.remove();

        const li = document.createElement('li');
        li.innerHTML = `
            <span>📄 ${name}</span>
            <small>${this.formatBytes(size)} by ${sharedBy}</small>
        `;
        list.appendChild(li);

        // Update count
        const countEl = document.getElementById('fileCount');
        if (countEl) {
            countEl.textContent = list.children.length;
        }
    }

    // Chat
    sendChat() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message) return;

        this.p2p.broadcast({
            type: 'chat',
            username: this.username,
            message: message,
            timestamp: Date.now()
        });

        this.displayChatMessage(this.username, message, true);
        input.value = '';
    }

    displayChatMessage(username, message, isSelf = false) {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'chat-message';
        div.innerHTML = `
            <span class="user" style="color: ${isSelf ? 'var(--primary-light)' : 'var(--success)'}">${username}:</span>
            <span>${this.escapeHtml(message)}</span>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // UI Utilities
    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const div = document.createElement('div');
        div.className = `notification ${type}`;
        div.textContent = message;
        container.appendChild(div);

        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        }, 3000);
    }

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));

        // Show selected
        document.getElementById(tabName + 'Tab').classList.add('active');
        event.target.classList.add('active');
    }

    updateParticipantCount() {
        const stats = this.p2p.getStats();
        const countEl = document.getElementById('studentCount');
        if (countEl) {
            countEl.textContent = stats.channels;
        }
    }

    async copyCode() {
        if (this.currentRoom) {
            await navigator.clipboard.writeText(this.currentRoom);
            this.showNotification('Room code copied!', 'success');
        }
    }

    async closeRoom() {
        if (confirm('Close this room? All participants will be disconnected.')) {
            // Delete room data
            await this.storage.deleteRoom(this.currentRoom);

            // Close P2P connections
            this.p2p.close();

            // Reset state
            this.currentRoom = null;
            this.p2p = null;
            this.slideSync = null;
            this.pollManager = null;

            // Back to landing
            this.showView('landing');
            this.showNotification('Room closed', 'info');
        }
    }

    async leaveRoom() {
        if (confirm('Leave this room?')) {
            this.p2p.close();

            this.currentRoom = null;
            this.p2p = null;
            this.slideSync = null;
            this.pollManager = null;

            this.showView('landing');
            this.showNotification('Left room', 'info');
        }
    }

    // Utilities
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app
const app = new App();