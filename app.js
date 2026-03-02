/**
 * Relay
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

        // Auto-fill room code from URL parameter (for QR code scanning)
        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get('room');
        if (roomFromUrl) {
            const roomCodeInput = document.getElementById('roomCode');
            if (roomCodeInput) {
                roomCodeInput.value = roomFromUrl;
                console.log('📱 Room code auto-filled from QR scan:', roomFromUrl);
            }
        }

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

    // ========== Room Management (UPDATED FOR P2P FIX) ==========

    async createRoom() {
        try {
            // FIX: Auto-detect the Python server's IP
            const signalingIp = window.location.hostname || 'localhost';
            
            this.p2p = new P2PManager(signalingIp);
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
            this.showNotification('Failed to create room. Is Python server running?', 'error');
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
            // FIX: Auto-detect the Python server's IP from the URL
            const signalingIp = window.location.hostname || 'localhost';

            this.p2p = new P2PManager(signalingIp);
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

            // Announce join - Note: This happens AFTER WebRTC connects
            // Usually triggered via onPeerConnect callback for reliability
            
            this.showNotification(`Connecting to room: ${roomCode}...`, 'info');

        } catch (error) {
            console.error('Failed to join room:', error);
            this.showNotification('Failed to join room. Check connection.', 'error');
        }
    }

    setupP2PCallbacks() {
        this.p2p.onMessage((peerId, data) => {
            this.handleMessage(peerId, data);
        });

        this.p2p.onPeerConnect((peerId) => {
            console.log('✅ Peer connected:', peerId);
            
            // If we are the participant, announce our username to the host
            if (!this.isHost) {
                this.p2p.send(peerId, {
                    type: 'user_joined',
                    username: this.username,
                    userId: this.p2p.localId
                });
            }
            
            this.updateParticipantCount();
        });

        this.p2p.onPeerDisconnect((peerId) => {
            console.log('❌ Peer disconnected:', peerId);
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

        // Add participant if not already there
        if (!document.querySelector(`[data-peer-id="${peerId}"]`)) {
            const li = document.createElement('li');
            li.dataset.peerId = peerId;
            li.textContent = `👤 ${username}`;
            list.appendChild(li);
        }

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
            const status = checkbox.checked ? 'ON' : 'OFF';
            
            // Update label text
            const label = checkbox.closest('.auto-save-toggle').querySelector('small');
            if (label) {
                label.textContent = `Auto-capture (${status})`;
            }
            
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

            this.p2p.broadcast({
                type: 'file_metadata',
                file: fileInfo
            });

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
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName + 'Tab')?.classList.add('active');
    }

    toggleSection(sectionId) {
        // Only on mobile - toggle expand/collapse
        if (window.innerWidth <= 640) {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.toggle('expanded');
            }
        }
    }

    // ========== QR Code ==========

    showQRCode() {
        const modal = document.getElementById('qrModal');
        const container = document.getElementById('qrCodeContainer');
        const codeDisplay = document.getElementById('qrRoomCode');

        if (!modal || !container || !this.roomId) {
            console.error('QR: Missing elements');
            return;
        }

        // Clear previous content
        container.innerHTML = '';

        // Check if QRCode library is loaded
        if (typeof QRCode === 'undefined') {
            console.error('❌ QRCode library not loaded!');
            container.innerHTML = '<div style="background: white; padding: 2rem; border-radius: 1rem;"><p style="color: #ef4444;">QR library not loaded</p></div>';
            codeDisplay.textContent = this.roomId;
            modal.classList.remove('hidden');
            return;
        }

        try {
            // Create a wrapper div for the QR code
            const qrWrapper = document.createElement('div');
            qrWrapper.style.cssText = 'background: white; padding: 2rem; border-radius: 1rem; display: inline-block;';
            container.appendChild(qrWrapper);

            // Generate QR code into the wrapper with FULL URL
            const roomUrl = window.location.origin + window.location.pathname + '?room=' + this.roomId;
            new QRCode(qrWrapper, {
                text: roomUrl,  // Full URL instead of just room code
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff"
            });

            // Update room code display
            codeDisplay.textContent = this.roomId;
            
            // Show modal
            modal.classList.remove('hidden');
            
            console.log('✅ QR code generated successfully');
        } catch (error) {
            console.error('❌ QR generation error:', error);
            container.innerHTML = '<div style="background: white; padding: 2rem; border-radius: 1rem;"><p style="color: #ef4444;">QR generation failed: ' + error.message + '</p></div>';
            codeDisplay.textContent = this.roomId;
            modal.classList.remove('hidden');
        }
    }

    hideQRCode() {
        const modal = document.getElementById('qrModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

	// ========== QR Scanner Functions ==========
	async showQRScanner() {
	  const modal = document.getElementById('scannerModal');
	  const reader = document.getElementById('qr-reader');

	  if (!modal || !reader) return;

	  // Show modal
	  modal.classList.remove('hidden');
	  reader.innerHTML = "";

	  // Check library
	  if (typeof Html5Qrcode === 'undefined') {
	    reader.innerHTML = `
	      <div style="padding:2rem;text-align:center;color:#ef4444;">
		Scanner library not loaded
	      </div>
	    `;
	    return;
	  }

	  try {
	    // Stop existing scanner if running
	    if (this.qrScanner) {
	      try {
		await this.qrScanner.stop();
		await this.qrScanner.clear();
	      } catch (e) {}
	    }

	    // Create scanner
	    this.qrScanner = new Html5Qrcode("qr-reader");

	    // Get cameras (this triggers permission popup)
	    const devices = await Html5Qrcode.getCameras();

	    if (!devices || devices.length === 0) {
	      throw new Error("No camera devices found");
	    }

	    // Prefer back camera if available
	    let cameraId = devices[0].id;
	    const backCam = devices.find(d =>
	      d.label.toLowerCase().includes("back") ||
	      d.label.toLowerCase().includes("environment")
	    );
	    if (backCam) cameraId = backCam.id;

	    await this.qrScanner.start(
	      cameraId,
	      {
		fps: 10,
		qrbox: { width: 250, height: 250 }
	      },
	      (decodedText) => {
		console.log("✅ QR Scanned:", decodedText);
		this.handleScannedQR(decodedText);
		this.hideQRScanner();
	      },
	      () => {} // Ignore frame errors
	    );

	  } catch (err) {
	    console.error("❌ Scanner error:", err);

	    reader.innerHTML = `
	      <div style="padding:2rem;text-align:center;color:#ef4444;">
		<p>Camera access denied or not available</p>
		<button class="btn btn-secondary" onclick="app.useManualCode()">
		  Enter Code Manually
		</button>
	      </div>
	    `;
	  }
	}

	async hideQRScanner() {
	  const modal = document.getElementById('scannerModal');
	  if (modal) modal.classList.add('hidden');

	  if (this.qrScanner) {
	    try {
	      await this.qrScanner.stop();
	      await this.qrScanner.clear();
	    } catch (e) {
	      console.warn("Scanner stop error:", e);
	    }
	  }
	}

	handleScannedQR(text) {
	  console.log('🔍 Processing scanned text:', text);
	  
	  // Stop scanner
	  this.hideQRScanner();
	  
	  // Try to extract room code from URL or raw text
	  let roomCode = text;
	  
	  // If it's a URL with room parameter
	  if (text.includes('#join') || text.includes('?room=')) {
	    try {
	      const url = new URL(text);
	      const hash = url.hash.replace('#', '');
	      const params = new URLSearchParams(hash);
	      roomCode = params.get('room') || roomCode;
	    } catch (e) {
	      // Not a valid URL, use raw text
	    }
	  }
	  
	  // Clean room code (remove any extra chars)
	  roomCode = roomCode.match(/[A-Z0-9-]+/i)?.[0] || roomCode;
	  
	  // Fill the form
	  const roomInput = document.getElementById('roomCode');
	  const nameInput = document.getElementById('username');
	  
	  if (roomInput) {
	    roomInput.value = roomCode.toUpperCase();
	    
	    // Auto-fill name if empty
	    if (nameInput && !nameInput.value) {
	      nameInput.value = 'Participant';
	    }
	    
	    // Show success message
	    this.showNotification(`✅ Room code filled: ${roomCode}`, 'success');
	    
	    // Optional: Auto-join after 1 second
	    setTimeout(() => {
	      if (nameInput.value && roomInput.value) {
		this.joinRoom();
	      }
	    }, 1000);
	  }
	}

	useManualCode() {
	  this.hideQRScanner();
	  document.getElementById('roomCode')?.focus();
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
            view.style.display = 'none';
        });

        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
            targetView.style.display = 'block';
            window.scrollTo(0, 0);
        }
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
