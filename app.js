/**
 * Relay - Main Application
 * P2P Collaboration Hub for LAN
 */
class RelayApp {
    constructor() {
        this.p2p = null;
        this.storage = null;
        this.slideSync = null;
        this.pollManager = null;
        this.notesManager = null;
        
        this.roomId = null;
        this.username = '';
        this.isHost = false;
        this.participants = new Map();
        this.chatMessages = [];
        this.files = [];

        this.init();
    }

    init() {
        console.log('🚀 Relay initializing...');

        // Initialize storage
        this.storage = new SmartStorage();
        this.storage.cleanupOldRooms();

        // Setup drag and drop
        this.setupDragAndDrop();

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Prevent accidental page close
        window.addEventListener('beforeunload', (e) => {
            if (this.roomId) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        console.log('✅ Relay ready');
    }

    // ========== Room Management ==========

    async createRoom() {
        try {
            this.p2p = new P2PManager();
            this.roomId = await this.p2p.createRoom();
            this.isHost = true;
            this.username = 'Host';

            // Initialize managers
            this.slideSync = new SlideSync(this.p2p, this.storage);
            this.pollManager = new PollManager(this.p2p);
            this.notesManager = new NotesManager(this.p2p, this.storage);
            this.notesManager.init(true);

            // Setup P2P callbacks
            this.setupP2PCallbacks();

            // Save room
            await this.storage.saveRoom(this.roomId, {
                createdBy: this.username,
                createdAt: Date.now()
            });

            // Show room
            this.showView('host-room');
            document.getElementById('displayRoomCode').textContent = this.roomId;

            this.showNotification(`Room created! Code: ${this.roomId}`, 'success');

            // Copy to clipboard
            try {
                await navigator.clipboard.writeText(this.roomId);
                this.showNotification('Code copied to clipboard', 'info');
            } catch (e) {
                console.log('Clipboard not available');
            }

        } catch (error) {
            console.error('Failed to create room:', error);
            this.showNotification('Failed to create room', 'error');
        }
    }

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

            this.roomId = roomCode;
            this.isHost = false;
            this.username = username;

            // Initialize managers
            this.slideSync = new SlideSync(this.p2p, this.storage);
            this.notesManager = new NotesManager(this.p2p, this.storage);
            this.notesManager.init(false);

            // Load saved slides
            this.slideSync.loadSavedSlides();

            // Setup P2P callbacks
            this.setupP2PCallbacks();

            // Show room
            this.showView('participant-room');
            document.getElementById('participantRoomCode').textContent = roomCode;
            document.getElementById('participantNameDisplay').textContent = username;

            // Announce join
            this.p2p.broadcast({
                type: 'user_joined',
                username: username,
                userId: this.p2p.localId
            });

            this.showNotification(`Joined room: ${roomCode}`, 'success');

        } catch (error) {
            console.error('Failed to join room:', error);
            this.showNotification('Failed to join room', 'error');
        }
    }

    setupP2PCallbacks() {
        this.p2p.onMessage((peerId, data) => {
            this.handleMessage(peerId, data);
        });

        this.p2p.onPeerConnect((peerId) => {
            console.log('Peer connected:', peerId);
            this.updateParticipantCount();
        });

        this.p2p.onPeerDisconnect((peerId) => {
            console.log('Peer disconnected:', peerId);
            this.removeParticipant(peerId);
            this.updateParticipantCount();
        });
    }

    handleMessage(peerId, data) {
        if (typeof data === 'object' && data.type) {
            switch (data.type) {
                case 'user_joined':
                    this.addParticipant(peerId, data.username);
                    break;
                
                case 'slide_update':
                    if (!this.isHost) {
                        this.slideSync.receiveFrame(data.data);
                    }
                    break;
                
                case 'poll_created':
                    if (!this.isHost) {
                        this.pollManager.displayParticipantPoll(data.poll);
                    }
                    break;
                
                case 'poll_vote':
                    if (this.isHost) {
                        this.pollManager.receiveVote(peerId, data.option);
                    }
                    break;
                
                case 'poll_closed':
                    if (!this.isHost) {
                        this.pollManager.handlePollClosed(data.pollId);
                    }
                    break;
                
                case 'notes_update':
                    if (!this.isHost) {
                        this.notesManager.receiveUpdate(data.content);
                    }
                    break;
                
                case 'notes_cleared':
                    if (!this.isHost) {
                        this.notesManager.handleNotesCleared();
                    }
                    break;
                
                case 'chat_message':
                    this.receiveChatMessage(peerId, data);
                    break;
                
                case 'file_metadata':
                    this.receiveFileMetadata(data);
                    break;
            }
        }
    }

    addParticipant(peerId, username) {
        this.participants.set(peerId, { username, peerId });
        
        const list = document.getElementById('participantList');
        if (!list) return;

        // Remove empty state
        const empty = list.querySelector('.empty');
        if (empty) empty.remove();

        // Add participant
        const li = document.createElement('li');
        li.dataset.peerId = peerId;
        li.textContent = `👤 ${username}`;
        list.appendChild(li);

        this.updateParticipantCount();
        this.showNotification(`${username} joined`, 'info');
    }

    removeParticipant(peerId) {
        const participant = this.participants.get(peerId);
        if (participant) {
            this.showNotification(`${participant.username} left`, 'info');
        }

        this.participants.delete(peerId);
        
        const li = document.querySelector(`[data-peer-id="${peerId}"]`);
        if (li) li.remove();

        const list = document.getElementById('participantList');
        if (list && list.children.length === 0) {
            list.innerHTML = '<li class="empty">Waiting for participants...</li>';
        }

        this.updateParticipantCount();
    }

    updateParticipantCount() {
        const count = this.participants.size;
        
        const els = [
            document.getElementById('participantCount'),
            document.getElementById('participantCountSidebar')
        ];

        els.forEach(el => {
            if (el) el.textContent = count;
        });
    }

    closeRoom() {
        if (!confirm('Close room? All participants will be disconnected.')) {
            return;
        }

        this.cleanup();
        this.showView('landing');
        this.showNotification('Room closed', 'info');
    }

    leaveRoom() {
        if (!confirm('Leave room?')) {
            return;
        }

        this.cleanup();
        this.showView('landing');
        this.showNotification('Left room', 'info');
    }

    cleanup() {
        if (this.p2p) {
            this.p2p.close();
        }

        if (this.slideSync) {
            this.slideSync.stopScreenShare();
        }

        this.roomId = null;
        this.isHost = false;
        this.participants.clear();
        this.chatMessages = [];
        this.files = [];
    }

    // ========== Screen Sharing ==========

    async toggleScreenShare() {
        const btn = document.getElementById('shareBtn');
        
        if (!this.slideSync.isSharing) {
            try {
                await this.slideSync.startScreenShare();
                btn.textContent = 'Stop Sharing';
                btn.classList.add('btn-danger');
                btn.classList.remove('btn-primary');
                this.showNotification('Screen sharing started', 'success');
            } catch (error) {
                this.showNotification('Failed to start screen share', 'error');
            }
        } else {
            this.slideSync.stopScreenShare();
            btn.textContent = 'Start Sharing';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-primary');
            this.showNotification('Screen sharing stopped', 'info');
        }
    }

    async saveCurrentSlide() {
        const liveSlide = document.getElementById('liveSlide');
        if (!liveSlide || !liveSlide.src) {
            this.showNotification('No slide to save', 'error');
            return;
        }

        await this.slideSync.saveSlide(liveSlide.src);
        this.showNotification('Slide saved', 'success');
    }

    toggleAutoSave() {
        const checkbox = document.getElementById('autoSave');
        if (checkbox) {
            this.slideSync.setAutoSave(checkbox.checked);
            const status = checkbox.checked ? 'enabled' : 'disabled';
            this.showNotification(`Auto-capture ${status}`, 'info');
        }
    }

    async downloadAllSlides() {
        await this.slideSync.downloadAllSlides();
    }

    // ========== Polls ==========

    createPoll() {
        const questionInput = document.getElementById('pollQuestion');
        const optionInputs = document.querySelectorAll('.poll-option');

        const question = questionInput.value.trim();
        const options = Array.from(optionInputs)
            .map(input => input.value.trim())
            .filter(val => val.length > 0);

        if (!question) {
            this.showNotification('Please enter a question', 'error');
            return;
        }

        if (options.length < 2) {
            this.showNotification('Please enter at least 2 options', 'error');
            return;
        }

        try {
            this.pollManager.createPoll(question, options);
            this.showNotification('Poll started', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    addPollOption() {
        this.pollManager.addOption();
    }

    closePoll() {
        this.pollManager.closePoll();
        this.showNotification('Poll closed', 'info');
    }

    // ========== Notes ==========

    toggleNotes() {
        this.notesManager.toggle();
    }

    clearNotes() {
        this.notesManager.clearNotes();
    }

    // ========== Files ==========

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
                dropZone.style.borderColor = 'var(--primary)';
                dropZone.style.background = 'rgba(99, 102, 241, 0.1)';
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = 'var(--border)';
                dropZone.style.background = '';
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
    }

    async handleFiles(fileList) {
        if (!this.isHost) return;

        const files = Array.from(fileList);
        
        for (const file of files) {
            // Check file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                this.showNotification(`File too large: ${file.name} (max 10MB)`, 'error');
                continue;
            }

            const fileInfo = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: file.name,
                size: file.size,
                type: file.type,
                timestamp: Date.now()
            };

            this.files.push(fileInfo);
            this.displayFile(fileInfo);

            // Broadcast metadata
            this.p2p.broadcast({
                type: 'file_metadata',
                file: fileInfo
            });

            // Read file and broadcast chunks (simplified)
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target.result;
                this.p2p.broadcast({
                    type: 'file_data',
                    fileId: fileInfo.id,
                    data: data
                });
            };
            reader.readAsDataURL(file);
        }

        this.updateFileCount();
    }

    receiveFileMetadata(data) {
        this.files.push(data.file);
        this.displayFile(data.file, true);
        this.updateFileCount();
    }

    displayFile(fileInfo, isParticipant = false) {
        const listId = isParticipant ? 'participantFileList' : 'fileList';
        const list = document.getElementById(listId);
        if (!list) return;

        // Remove empty state
        const empty = list.querySelector('.empty');
        if (empty) empty.remove();

        const li = document.createElement('li');
        li.dataset.fileId = fileInfo.id;
        
        const info = document.createElement('div');
        info.className = 'file-info';
        
        const name = document.createElement('div');
        name.className = 'file-name';
        name.textContent = fileInfo.name;
        
        const size = document.createElement('div');
        size.className = 'file-size';
        size.textContent = this.formatFileSize(fileInfo.size);
        
        info.appendChild(name);
        info.appendChild(size);
        
        li.appendChild(info);
        list.appendChild(li);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateFileCount() {
        const fileCount = document.getElementById('fileCount');
        if (fileCount) {
            fileCount.textContent = this.files.length;
        }
    }

    // ========== Chat ==========

    sendChat() {
        const input = document.getElementById('chatInput');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        const chatData = {
            type: 'chat_message',
            sender: this.username,
            senderId: this.p2p.localId,
            message: message,
            timestamp: Date.now()
        };

        this.p2p.broadcast(chatData);
        this.displayChatMessage(chatData, true);

        input.value = '';
    }

    receiveChatMessage(peerId, data) {
        this.displayChatMessage(data, false);
    }

    displayChatMessage(data, isOwn) {
        const chatBox = document.getElementById('chatMessages');
        if (!chatBox) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message' + (isOwn ? ' own' : '');
        
        if (!isOwn) {
            const sender = document.createElement('div');
            sender.className = 'chat-sender';
            sender.textContent = data.sender;
            msgDiv.appendChild(sender);
        }

        const text = document.createElement('div');
        text.textContent = data.message;
        msgDiv.appendChild(text);

        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    switchTab(tabName) {
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName + 'Tab')?.classList.add('active');
    }

    // ========== QR Code ==========

    showQRCode() {
        const modal = document.getElementById('qrModal');
        const container = document.getElementById('qrCodeContainer');
        const codeDisplay = document.getElementById('qrRoomCode');

        if (!modal || !container || !this.roomId) return;

        // Clear previous QR
        container.innerHTML = '';

        // Create QR code
        try {
            new QRCode(container, {
                text: window.location.origin + '/#' + this.roomId,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            codeDisplay.textContent = this.roomId;
            modal.classList.remove('hidden');
        } catch (error) {
            console.error('QR code error:', error);
            this.showNotification('Failed to generate QR code', 'error');
        }
    }

    hideQRCode() {
        const modal = document.getElementById('qrModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showQRScanner() {
        this.showNotification('QR scanning not yet implemented', 'info');
    }

    // ========== Utilities ==========

    async copyCode() {
        if (!this.roomId) return;

        try {
            await navigator.clipboard.writeText(this.roomId);
            this.showNotification('Code copied!', 'success');
        } catch (e) {
            this.showNotification('Failed to copy code', 'error');
        }
    }

    showView(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        document.getElementById(viewId)?.classList.add('active');
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ',
            warning: '⚠'
        };

        notification.innerHTML = `
            <span class="icon">${icons[type] || icons.info}</span>
            <span class="message">${message}</span>
        `;

        container.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to send chat
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const chatInput = document.getElementById('chatInput');
                if (chatInput && document.activeElement === chatInput) {
                    this.sendChat();
                }
            }
        });
    }
}

// Initialize app
const app = new RelayApp();
window.app = app;

console.log('🔗 Relay loaded successfully');
