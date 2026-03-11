/**
 * Relay - P2P Collaboration Hub for LAN (FINAL FIXED VERSION)
 */
class DeskDockApp {
    constructor() {
        this.p2p = null;
        this.storage = null;
        this.slideSync = null;
        this.pollManager = null;
        this.notesManager = null;
        this.pptxRenderer = null;
        this.overlayControls = null;
        this.sourceManager = null;
        
        this.roomId = null;
        this.username = '';
        // REMOVED: this.isHost - not needed, causes bugs
        
        this.participants = new Map();
        this.chatMessages = [];
        this.files = [];

        this.init();
    }

    init() {
        console.log('🚀 Relay initializing...');
        this.storage = new SmartStorage();
        this.storage.cleanupOldRooms();

        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get('room');
        if (roomFromUrl) {
            const roomCodeInput = document.getElementById('roomCode');
            if (roomCodeInput) {
                roomCodeInput.value = roomFromUrl;
                console.log('📱 Room code auto-filled from QR scan:', roomFromUrl);
            }
        }

        this.setupDragAndDrop();
        this.setupKeyboardShortcuts();

        window.addEventListener('beforeunload', (e) => {
            if (this.roomId) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        console.log('✅ Relay ready');
    }

    // ========== SOURCE MANAGEMENT (Multi-Source Switching) ==========
    
    initializeSourceTabs() {
        if (!this.sourceManager) return;
        
        const tabBar = document.getElementById('sourceTabBar');
        if (!tabBar) return;
        
        console.log('🎯 Initializing source tabs...');
        
        // Listen to source manager events
        this.sourceManager.on('sourceRegistered', (source) => {
            this.addSourceTab(source);
            // Show tab bar when we have sources
            tabBar.style.display = 'flex';
        });
        
        this.sourceManager.on('sourceActivated', (source, previousId) => {
            this.updateActiveTab(source.id);
            this.renderActiveSource(source);
        });
        
        this.sourceManager.on('sourceRemoved', (source) => {
            this.removeSourceTab(source.id);
            // Hide tab bar if no sources left
            if (this.sourceManager.getAllSources().length === 0) {
                tabBar.style.display = 'none';
            }
        });
        
        // Keyboard shortcuts (Alt+1, Alt+2, etc.)
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                this.sourceManager.activateSourceByIndex(index);
            }
        });
        
        console.log('✅ Source tabs initialized');
    }
    
    initializeDragAndDrop() {
        // Make preview area draggable when showing slides
        const previewContainer = document.getElementById('hostPreview');
        const dropZone = document.getElementById('dropZone');
        
        if (!previewContainer || !dropZone) {
            console.warn('Preview or drop zone not found for drag-and-drop');
            return;
        }
        
        // Make preview container support drag start
        previewContainer.addEventListener('dragstart', (e) => {
            const activeSource = this.sourceManager?.getActiveSource();
            if (!activeSource || activeSource.type === 'screen') {
                e.preventDefault();
                return;
            }
            
            const pres = this.presentationManager?.getActive();
            if (!pres) {
                e.preventDefault();
                return;
            }
            
            // Store current slide info for drag
            e.dataTransfer.setData('slide-index', pres.current);
            e.dataTransfer.setData('source-id', activeSource.id);
            e.dataTransfer.effectAllowed = 'copy';
            
            // Visual feedback
            previewContainer.style.opacity = '0.5';
            this.showNotification('🖱️ Drag to Files to share current slide', 'info');
        });
        
        previewContainer.addEventListener('dragend', (e) => {
            previewContainer.style.opacity = '1';
        });
        
        // Set preview as draggable when slides are shown
        previewContainer.setAttribute('draggable', 'true');
        
        // Make drop zone accept drops
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Check if this is a slide drag (not file drag)
                e.dataTransfer.dropEffect = 'copy';
                dropZone.style.background = 'rgba(100, 150, 255, 0.2)';
                dropZone.style.borderColor = 'var(--primary)';
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.background = '';
            dropZone.style.borderColor = '';
        });
        
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Reset drop zone style
            dropZone.style.background = '';
            dropZone.style.borderColor = '';
            
            // Check if this is a slide drag
            const slideIndex = e.dataTransfer.getData('slide-index');
            const sourceId = e.dataTransfer.getData('source-id');
            
            if (slideIndex !== '' && sourceId) {
                // Share the dragged slide
                await this.shareSingleSlide(sourceId, parseInt(slideIndex));
            }

            // check for external File Drag 
            if (e.dataTransfer.files && e.dataTransfer.files.lenght > 0) {
                console.log("External files dropped");
                this.handleFiles(e.dataTransfer.files);
            }
        });
        
        console.log('✅ Drag-and-drop initialized');
    }

    // for next and pre slide for any 
    nextSlide() {
        this.navigateActiveSource(1);
    }

    prevSlide() {
        this.navigateActiveSource(-1);
    }
    
    async shareSingleSlide(sourceId, slideIndex) {
        const source = this.sourceManager?.getAllSources().find(s => s.id === sourceId);
        if (!source) {
            this.showNotification('Source not found', 'error');
            return;
        }
        
        const pres = this.presentationManager?.presentations.get(source.data.presentationId);
        if (!pres || !pres.slides[slideIndex]) {
            this.showNotification('Slide not found', 'error');
            return;
        }
        
        try {
            const slide = pres.slides[slideIndex];
            
            // Convert data URL to Blob
            const response = await fetch(slide.data);
            const blob = await response.blob();
            
            // Create file object
            const fileName = `${source.metadata.title}_slide_${slideIndex + 1}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            
            // Share via P2P
            this.shareFile(file);
            
            this.showNotification(`✅ Shared slide ${slideIndex + 1}!`, 'success');
        } catch (error) {
            console.error('Failed to share slide:', error);
            this.showNotification('Failed to share slide', 'error');
        }
    }
    
    addSourceTab(source) {
        const tabBar = document.getElementById('sourceTabBar');
        console.log('🔍 addSourceTab called:', {
            sourceId: source.id,
            sourceType: source.type,
            tabBar: !!tabBar
        });
        
        if (!tabBar) {
            console.error('❌ Tab bar not found!');
            return;
        }
        
        // Check if tab already exists
        const existingTab = document.querySelector(`[data-source-id="${source.id}"]`);
        if (existingTab) {
            console.log(`⚠️ Tab already exists for ${source.id}, updating title`);
            // Update title instead of skipping
            const titleEl = existingTab.querySelector('.tab-title');
            if (titleEl) {
                titleEl.textContent = source.metadata.title;
            }
            return;
        }
        
        const tab = document.createElement('button');
        tab.className = 'source-tab';
        tab.dataset.sourceId = source.id;
        
        const index = this.sourceManager.getAllSources().findIndex(s => s.id === source.id);
        const shortcut = index < 9 ? `Alt+${index + 1}` : '';
        
        tab.innerHTML = `
            <span class="tab-icon">${source.metadata.icon}</span>
            <span class="tab-title">${source.metadata.title}</span>
            ${shortcut ? `<span class="tab-shortcut">${shortcut}</span>` : ''}
            <span class="tab-close" onclick="event.stopPropagation(); app.removeSource('${source.id}')">×</span>
        `;
        
        tab.onclick = () => {
            console.log(`🖱️ Tab clicked: ${source.id}`);
            this.sourceManager.activateSource(source.id);
        };
        
        tabBar.appendChild(tab);
        console.log(`✅ Tab added: ${source.id}, total tabs: ${tabBar.children.length}`);
        
        // Show tab bar if hidden and add has-tabs class
        if (tabBar.children.length > 0) {
            tabBar.style.display = 'flex';
            const screenShareCard = document.querySelector('.screen-share-card');
            if (screenShareCard) {
                screenShareCard.classList.add('has-tabs');
            }
        }
    }
    
    removeSourceTab(sourceId) {
        const tab = document.querySelector(`[data-source-id="${sourceId}"]`);
        if (tab) {
            tab.remove();
            console.log(`➖ Tab removed: ${sourceId}`);
            
            // Hide tab bar if empty and remove has-tabs class
            const tabBar = document.getElementById('sourceTabBar');
            if (tabBar && tabBar.children.length === 0) {
                tabBar.style.display = 'none';
                const screenShareCard = document.querySelector('.screen-share-card');
                if (screenShareCard) {
                    screenShareCard.classList.remove('has-tabs');
                }
            }
        }
    }
    
    updateActiveTab(sourceId) {
        // Remove active class from all tabs
        document.querySelectorAll('.source-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Add active class to current tab
        const activeTab = document.querySelector(`[data-source-id="${sourceId}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }
    
    renderActiveSource(source) {
        console.log(`🎨 Rendering source: ${source.id} (${source.type})`);
        
        const previewVideo = document.getElementById('previewVideo');
        const previewPlaceholder = document.getElementById('previewPlaceholder');
        const leftArrow = document.getElementById('navArrowLeft');
        const rightArrow = document.getElementById('navArrowRight');
        
        // FIRST: Hide everything
        if (previewVideo) {
            previewVideo.style.display = 'none';
            previewVideo.classList.remove('active');
        }
        
        if (previewPlaceholder) {
            previewPlaceholder.style.display = 'none';
            previewPlaceholder.classList.add('hidden');
        }
        
        // Hide navigation arrows by default
        if (leftArrow) leftArrow.style.display = 'none';
        if (rightArrow) rightArrow.style.display = 'none';
        
        // THEN: Show the active source
        switch (source.type) {
            case 'screen':
                // Show screen share video
                console.log('📺 Showing screen share');
                // pause file broadcasting while screen tab is active
                if(this.previewShare?.isSharing) this.previewShare.stopPreviewShare();
                if (previewVideo && this.slideSync && this.slideSync.isSharing) {
                    previewVideo.style.display = 'block';
                    previewVideo.classList.add('active');
                    if (this.slideSync.stream) {
                        previewVideo.srcObject = this.slideSync.stream;
                    }
                }

                // pause preview share while screen tab is active
                if (this.previewShare && this.previewShare.isSharing) {
                    this.previewShare.stopPreviewShare();
                }
                break;
                
            case 'pdf':
            case 'images':
                // Use PresentationManager!
                console.log(`📊 Showing ${source.type}: ${source.metadata.title}`);

                
                const presId = source.data.presentationId;
                if (!presId || !this.presentationManager) {
                    console.error('No presentation ID or manager!');
                    return;
                }
                
                // Set this as active presentation
                this.presentationManager.setActive(presId);
                
                // Get current slide
                const slide = this.presentationManager.getCurrentSlide();
                if (!slide) {
                    console.error('No current slide!');
                    return;
                }
                
                // Render the slide
                if (previewPlaceholder) {
                    previewPlaceholder.style.display = 'flex';
                    previewPlaceholder.classList.remove('hidden');
                    previewPlaceholder.innerHTML = `
                        <img src="${slide.data}" style="width: 100%; height: 100%; object-fit: contain;">
                    `;
                }
                
                // Show navigation arrows
                if (leftArrow) leftArrow.style.display = 'flex';
                if (rightArrow) rightArrow.style.display = 'flex';
                
                const pres = this.presentationManager.getActive();
                console.log(`✅ Rendered slide ${pres.current + 1}/${pres.slides.length}`);

                /*
                // to restart the preview share if it was paused
                if (this.previewShare && !this.previewShare.isSharing){
                    this.previewShare.startPreviewShare();
                }
                */
                // start previewShare after img is in Dom
                if (this.previewShare) {
                    if(this.previewShare.isSharing) this.previewShare.stopPreviewShare();
                    setTimeout(() => this.previewShare.startPreviewShare(),100);
                }
                break;
                
            default:
                console.warn(`Unknown source type: ${source.type}`);
        }
    }
    
    removeSource(sourceId) {
        if (this.sourceManager) {
            this.sourceManager.removeSource(sourceId);
        }
    }

    async shareCurrentToParticipants() {
        const activeSource = this.sourceManager?.getActiveSource();
        if (!activeSource) {
            this.showNotification('No active source to share', 'error');
            return;
        }

        // For PDFs and images, export current slide as image file
        if (activeSource.type === 'pdf' || activeSource.type === 'images') {
            const pres = this.presentationManager?.getActive();
            if (!pres || !pres.slides.length) {
                this.showNotification('No slide to share', 'error');
                return;
            }

            const currentSlide = pres.slides[pres.current];
            if (!currentSlide) {
                this.showNotification('Current slide not found', 'error');
                return;
            }

            // Convert data URL to Blob
            const dataURL = currentSlide.data;
            const response = await fetch(dataURL);
            const blob = await response.blob();
            
            // Create file object
            const fileName = `${activeSource.metadata.title}_slide_${pres.current + 1}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            
            // Share via P2P
            this.shareFile(file);
            
            this.showNotification(`📤 Shared slide ${pres.current + 1} to participants`, 'success');
        } 
        // For screen share, just notify (can't export screen)
        else if (activeSource.type === 'screen') {
            this.showNotification('Screen share is already broadcasting live!', 'info');
        }
        else {
            this.showNotification('Cannot share this source type', 'error');
        }
    }

    async shareAllToParticipants() {
        const activeSource = this.sourceManager?.getActiveSource();
        if (!activeSource) {
            this.showNotification('No active source to share', 'error');
            return;
        }

        // Only works for PDFs and images
        if (activeSource.type === 'pdf' || activeSource.type === 'images') {
            const pres = this.presentationManager?.getActive();
            if (!pres || !pres.slides.length) {
                this.showNotification('No slides to share', 'error');
                return;
            }

            this.showNotification(`📤 Sharing ${pres.slides.length} slides...`, 'info');

            // Share all slides
            let successCount = 0;
            for (let i = 0; i < pres.slides.length; i++) {
                const slide = pres.slides[i];
                try {
                    // Convert data URL to Blob
                    const response = await fetch(slide.data);
                    const blob = await response.blob();
                    
                    // Create file object
                    const fileName = `${activeSource.metadata.title}_slide_${i + 1}.jpg`;
                    const file = new File([blob], fileName, { type: 'image/jpeg' });
                    
                    // Share via P2P
                    this.shareFile(file);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to share slide ${i + 1}:`, error);
                }
            }

            this.showNotification(`✅ Shared ${successCount}/${pres.slides.length} slides!`, 'success');
        } 
        else if (activeSource.type === 'screen') {
            this.showNotification('Screen share is already broadcasting live!', 'info');
        }
        else {
            this.showNotification('Cannot share this source type', 'error');
        }
    }

    shareFile(file) {
        // Add to local files list
        this.files.push({
            name: file.name,
            size: file.size,
            timestamp: Date.now(),
            data: file
        });

        // Broadcast file info to participants
        if (this.p2p) {
            // Convert file to base64 for transmission
            const reader = new FileReader();
            reader.onload = (e) => {
                this.p2p.broadcast({
                    type: 'file_shared',
                    file: {
                        name: file.name,
                        size: file.size,
                        data: e.target.result,
                        timestamp: Date.now()
                    }
                });
            };
            reader.readAsDataURL(file);
        }

        // Update UI (if on files tab)
        this.updateFilesList();
        
        console.log('📤 File shared:', file.name);
    }

    updateFilesList() {
        const list = document.getElementById('participantFileList');
        if (!list) return;

        if (this.files.length === 0) {
            list.innerHTML = '<li class="empty">No files shared yet</li>';
            return;
        }

        list.innerHTML = '';
        this.files.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            const fileSize = (file.size / 1024).toFixed(1) + ' KB';
            const timestamp = new Date(file.timestamp).toLocaleTimeString();
            
            li.innerHTML = `
                <div class="file-info">
                    <strong><i class="fa-solid fa-file"></i> ${file.name}</strong>
                    <span class="file-meta">${fileSize} • ${timestamp}</span>
                </div>
                <button class="btn btn-small" onclick="app.downloadFile(${index})">Download</button>
            `;
            list.appendChild(li);
        });
    }

    downloadFile(index) {
        const file = this.files[index];
        if (!file) return;

        const a = document.createElement('a');
        if (file.data instanceof File || file.data instanceof Blob) {
            a.href = URL.createObjectURL(file.data);
        } else {
            a.href = file.data; // Already a data URL
        }
        a.download = file.name;
        a.click();
    }

    navigateActiveSource(direction) {
        const activeSource = this.sourceManager?.getActiveSource();
        if (!activeSource) return;

        // Only navigate for pdf/images, not screen
        if (activeSource.type === 'screen') return;

        if (!this.presentationManager) return;

        // Navigate using PresentationManager
        const moved = direction > 0 
            ? this.presentationManager.next() 
            : this.presentationManager.prev();

        if (moved) {
            // Re-render
            this.renderActiveSource(activeSource);
            
            const pres = this.presentationManager.getActive();
            console.log(`📄 Navigated to slide ${pres.current + 1}/${pres.slides.length}`);
        }
    }

    // ========== Room Management ==========
    async createRoom() {
        this.roomId = "room-" + Math.random().toString(36).substring(2,8);
        this.p2p = new P2PManager();
        await this.p2p.connect(this.roomId);
        
        // ✅ FIX: Initialize ALL managers
        this.slideSync = new SlideSync(this.p2p, this.storage);
        this.pollManager = new PollManager(this.p2p);
        this.notesManager = new NotesManager(this.p2p, this.storage);
        this.notesManager.init(true); // true = host mode
        
        // ✅ NEW: Initialize PresentationManager (proper state management)
        this.presentationManager = new PresentationManager();
        
        // ✅ NEW: Initialize SourceManager for multi-source switching
        this.sourceManager = new SourceManager(this.p2p);
        
        // Initialize preview share — broadcasts loaded files to participants
        this.previewShare = new PreviewShareManager(this.sourceManager);
        this.previewShare.onFrameReady = (jpeg) => {
            const activeSource = this.sourceManager?.getActiveSource();
            if(!activeSource || activeSource.type == 'screen') return;
            if (this.p2p) {
                this.p2p.broadcast({
                    type: 'slide_update',
                    data: jpeg,
                    timestamp: Date.now()
                });
            }
        };

        // ✅ NEW: Initialize PowerPoint and Overlay modules
        this.pptxRenderer = new PPTXRenderer(this.p2p, this.storage, this.slideSync);
        this.pptxRenderer.init();
        
        // Initialize overlay controls (will show when screen sharing starts)
        const previewContainer = document.querySelector('.video-preview');
        if (previewContainer) {
            this.overlayControls = new OverlayControls(previewContainer, {
                onCreatePoll: () => this.switchTab('polls'),
                onToggleNotes: () => this.toggleNotes(),
                onShareFile: () => document.getElementById('fileInput')?.click(),
                onNextSlide: () => this.navigateActiveSource(1)
            });
            this.overlayControls.init();
        }
        
        this.setupP2PCallbacks();
        this.showView("host-room");
        document.getElementById("displayRoomCode").textContent = this.roomId;
        
        // ✅ NEW: Initialize source tab system
        this.initializeSourceTabs();
        
        // ✅ NEW: Initialize drag-and-drop for slides
        this.initializeDragAndDrop();
    }

    async joinRoom() {
        const roomCode = document.getElementById('roomCode').value.trim();
        const username = document.getElementById('username').value || "Anonymous";

        if (!roomCode) {
            this.showNotification("Enter room code", "error");
            return;
        }

        this.username = username;
        this.roomId = roomCode;
        this.p2p = new P2PManager();
        await this.p2p.connect(roomCode);
        
        // ✅ FIX: Initialize ALL managers
        this.slideSync = new SlideSync(this.p2p, this.storage);
        this.pollManager = new PollManager(this.p2p);
        this.notesManager = new NotesManager(this.p2p, this.storage);
        this.notesManager.init(false); // false = participant mode
        
        // ✅ NEW: Initialize SourceManager for participants (to receive source switches)
        this.sourceManager = new SourceManager(this.p2p);
        
        // ✅ NEW: Initialize PowerPoint renderer (to receive slides)
        this.pptxRenderer = new PPTXRenderer(this.p2p, this.storage, this.slideSync);
        // Participants don't need UI init, just need to receive slides
        
        this.setupP2PCallbacks();
        this.showView("participant-room");
        document.getElementById("participantRoomCode").textContent = roomCode;
        document.getElementById("participantNameDisplay").textContent = username;
    }

    setupP2PCallbacks() {
        this.p2p.onPeerConnect((peerId) => {
            console.log("✅ Peer connected:", peerId);
            this.updateParticipantCount();
            // Announce ourselves
            this.p2p.broadcast({
                type: "user_joined",
                username: this.username || "User"
            });
        });

        this.p2p.onMessage((peerId, data) => {
            this.handleMessage(peerId, data);
        });

        this.p2p.onPeerDisconnect((peerId) => {
            console.log("❌ Peer disconnected:", peerId);
            this.removeParticipant(peerId);
        });
    }

    handleMessage(peerId, data) {
        if (typeof data !== 'object' || !data.type) return;

        switch (data.type) {
            case "user_joined":
                this.addParticipant(peerId, data.username);
                break;
            
            // ✅ FIX: Removed ALL if (this.isHost) checks
            // In mesh P2P, EVERY peer handles EVERY message
            
            case 'slide_update':
                if (this.slideSync) {
                    this.slideSync.receiveFrame(data.data);
                }
                break;
            
            case 'poll_created':
                if (this.pollManager) {
                    this.pollManager.displayParticipantPoll(data.poll);
                }
                break;
            
            case 'poll_vote':
                if (this.pollManager) {
                    this.pollManager.receiveVote(peerId, data.option);
                }
                break;
            
            case 'poll_closed':
                if (this.pollManager) {
                    this.pollManager.handlePollClosed(data.pollId);
                }
                break;
            
            case 'notes_update':
                if (this.notesManager) {
                    this.notesManager.receiveUpdate(data.content);
                }
                break;
            
            case 'notes_cleared':
                if (this.notesManager) {
                    this.notesManager.handleNotesCleared();
                }
                break;
            
            case 'chat_message':
                this.receiveChatMessage(peerId, data);
                break;
            
            case 'file_metadata':
                this.receiveFileMetadata(data);
                break;

            case 'file_data':
                this.receiveFileData(data);
                break;
            
            // ✅ NEW: PowerPoint presentation messages
            case 'pptx_loaded':
                if (this.pptxRenderer) {
                    this.pptxRenderer.handleSlidesReceived(data);
                }
                break;
            
            case 'slide_advance':
                if (this.pptxRenderer) {
                    this.pptxRenderer.handleSlideAdvance(data);
                }
                break;
            
            case 'presentation_ended':
                if (this.pptxRenderer) {
                    this.pptxRenderer.handlePresentationEnded();
                }
                break;
            
            // ✅ NEW: Source switching messages
            case 'source_registered':
                if (this.sourceManager) {
                    console.log('📥 Participant: Source registered from host');
                    // Participant just needs to know source exists
                }
                break;
            
            case 'source_activated':
                if (this.sourceManager) {
                    console.log('📥 Participant: Source activated -', data.sourceId);
                    // Participant needs to render this source
                    const source = { id: data.sourceId, type: data.sourceType, metadata: data.metadata };
                    this.renderActiveSource(source);
                }
                break;
            
            case 'source_removed':
                if (this.sourceManager) {
                    console.log('📥 Participant: Source removed -', data.sourceId);
                }
                break;
            
            case 'file_shared':
                // Participant receives shared file
                console.log('📥 Received file:', data.file.name);
                this.files.push(data.file);
                this.updateFilesList();
                this.showNotification(`New file: ${data.file.name}`, 'success');
                break;
        }
    }

    addParticipant(peerId, username) {
        if (this.participants.has(peerId)) return;
        this.participants.set(peerId, { username, peerId });
        
        const list = document.getElementById('participantList');
        if (!list) return;

        const empty = list.querySelector('.empty');
        if (empty) empty.remove();

        if (!document.querySelector(`[data-peer-id="${peerId}"]`)) {
            const li = document.createElement('li');
            li.dataset.peerId = peerId;
            li.innerHTML = `<i class="fa-solid fa-user"></i> ${username}<span class="status-dot connected" title="Connected"></span>`;
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
        if (li) {
            li.classList.add('disconnected');
            const dot = li.querySelector('.status-dot');
            if (dot) { dot.classList.remove('connected'); dot.classList.add('disconnected'); dot.title = 'Disconnected'; }
            setTimeout(() => li.remove(), 2000);
        }

        const list = document.getElementById('participantList');
        if (list && list.children.length === 0) {
            list.innerHTML = '<li class="empty">Waiting for participants...</li>';
        }
        this.updateParticipantCount();
    }

    updateParticipantCount() {
        const count = this.p2p ? this.p2p.dataChannels.size : 0;
        const els = [
            document.getElementById('participantCount'),
            document.getElementById('participantCountSidebar')
        ];
        els.forEach(el => { if (el) el.textContent = count; });
    }

    closeRoom() {
        showConfirm({
            title: 'Close Room',
            message: 'Close room? All participants will be disconnected.',
            confirmText: 'Close',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: () => {
                this.cleanup();
                this.showView('landing');
                this.showNotification('Room closed', 'info');
            }
        });
    }

    leaveRoom() {
        if (!confirm('Leave room?')) return;
        this.cleanup();
        this.showView('landing');
        this.showNotification('Left room', 'info');
    }

    cleanup() {
        if (this.p2p) this.p2p.close();
        if (this.slideSync) this.slideSync.stopScreenShare();
        this.roomId = null;
        this.participants.clear();
        this.chatMessages = [];
        this.files = [];
    }

    // ========== Screen Sharing ==========
    async toggleScreenShare() {
        const btn = document.getElementById('shareBtn');
        
        console.log('🎬 toggleScreenShare called');
        console.log('slideSync exists?', !!this.slideSync);
        console.log('slideSync.isSharing?', this.slideSync?.isSharing);
        
        if (!this.slideSync) {
            console.error('❌ SlideSync not initialized!');
            this.showNotification('Screen sharing not initialized', 'error');
            return;
        }
        
        if (!this.slideSync.isSharing) {
            try {
                console.log('🚀 Starting screen share...');
                await this.slideSync.startScreenShare();
                
                console.log('✅ Screen share started successfully!');
                btn.textContent = 'Stop Sharing';
                btn.classList.add('btn-danger');
                btn.classList.remove('btn-primary');
                this.showNotification('Screen sharing started', 'success');
                
                // ✅ NEW: Register screen share as a source
                if (this.sourceManager) {
                    this.sourceManager.registerSource('screen-1', 'screen', {
                        slideSync: this.slideSync,
                        stream: this.slideSync.stream
                    }, {
                        title: 'Screen Share',
                        icon: '🖥️'
                    });
                }

                
                if (this.previewShare && this.previewShare.isSharing) {
                    this.previewShare.stopPreviewShare();
                }
                
                // Show overlay controls when screen sharing starts
                if (this.overlayControls) {
                    this.overlayControls.show();
                }
            } catch (error) {
                console.error('💥 Screen share failed!');
                console.error('Error type:', error.constructor.name);
                console.error('Error name:', error.name);
                console.error('Error message:', error.message);
                console.error('Full error:', error);
                
                // Show detailed error to user
                let errorMsg = 'Failed to start screen share';
                if (error.message && error.message.includes('localhost')) {
                    errorMsg = '⚠️ Screen sharing requires HTTPS or localhost! Change URL from 10.x.x.x to localhost:8000';
                } else if (error.name === 'NotAllowedError') {
                    errorMsg = 'Permission denied - please allow screen sharing';
                } else if (error.name === 'NotFoundError') {
                    errorMsg = 'No screen available to share';
                } else if (error.name === 'NotSupportedError') {
                    errorMsg = 'Screen sharing not supported in this browser';
                } else if (error.message) {
                    errorMsg = error.message;
                }
                
                this.showNotification(errorMsg, 'error');
            }
        } else {
            console.log('🛑 Stopping screen share...');
            this.slideSync.stopScreenShare();
            btn.textContent = 'Start Sharing';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-primary');
            this.showNotification('Screen sharing stopped', 'info');
            
            // ✅ NEW: Remove screen share source
            if (this.sourceManager) {
                this.sourceManager.removeSource('screen-1');
            }

            if (this.previewShare) {
                const hasFileSources = this.sourceManager?.getAllSources()
                    .some(s => ['pptx', 'pdf', 'image'].includes(s.type));
                
                if (hasFileSources) {
                    this.previewShare.startPreviewShare();
                }
            }
            
            // Hide overlay controls when screen sharing stops
            if (this.overlayControls) {
                this.overlayControls.hide();
            }
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

    // toggleAutoSave() {
    //     const checkbox = document.getElementById('autoSave');
    //     if (checkbox && this.slideSync) {
    //         this.slideSync.setAutoSave(checkbox.checked);
    //         const status = checkbox.checked ? 'ON' : 'OFF';
    //         const label = checkbox.closest('.auto-save-toggle')?.querySelector('small');
    //         if (label) label.textContent = `Auto-capture (${status})`;
    //         this.showNotification(`Auto-capture ${status}`, 'info');
    //     }
    // }

    async downloadAllSlides() {
        await this.slideSync.downloadAllSlides();
    }

    // ========== Polls ==========
    createPoll() {
        if (!this.pollManager) {
            this.showNotification('Poll system not ready', 'error');
            return;
        }
        const questionInput = document.getElementById('pollQuestion');
        const optionInputs = document.querySelectorAll('.poll-option');
        const question = questionInput?.value.trim();
        const options = Array.from(optionInputs)
            .map(input => input.value.trim())
            .filter(val => val.length > 0);

        if (!question) { this.showNotification('Please enter a question', 'error'); return; }
        if (options.length < 2) { this.showNotification('Please enter at least 2 options', 'error'); return; }

        try {
            this.pollManager.createPoll(question, options);
            this.showNotification('Poll started', 'success');
        } catch (error) {
            console.error(error);
            this.showNotification(error.message, 'error');
        }
    }

    addPollOption() { this.pollManager?.addOption(); }
    closePoll() { this.pollManager?.closePoll(); this.showNotification('Poll closed', 'info'); }

    // ========== Notes ==========
    toggleNotes() { this.notesManager?.toggle(); }
    clearNotes() {
        showConfirm({
            title: 'Clear Notes',
            message: 'Clear all notes? This cannot be undone.',
            confirmText: 'OK',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: () => {
                const textarea = document.getElementById('notesTextarea');
                if (textarea) textarea.value = '';
                if (this.notesManager) {
                    this.notesManager.lastContent = '';
                    if (this.storage && this.roomId) this.storage.clearNotes(this.roomId);
                    this.p2p?.broadcast({ type: 'notes_cleared', timestamp: Date.now() });
                    this.notesManager.showSaveStatus('Notes cleared');
                }
            }
        });
    }

    // ========== Files ==========
    setupDragAndDrop() {
        const dropZone = document.getElementById('dropZone');
        if (!dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
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
        // ✅ FIX: Removed "if (!this.isHost) return;" - ANY peer can share files now
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

            this.p2p.broadcast({ type: 'file_metadata', file: fileInfo });

            const reader = new FileReader();
            reader.onload = (e) => {
                // Store data locally so the host can also download the file
                const entry = this.files.find(f => f.id === fileInfo.id);
                if (entry) entry.data = e.target.result;
                this.enableDownloadButton(fileInfo.id);

                this.p2p.broadcast({
                    type: 'file_data',
                    fileId: fileInfo.id,
                    data: e.target.result
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
        li.className = 'file-item';
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

        if (isParticipant) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-small download-btn';
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;
            btn.title = 'Waiting for file data...';
            btn.onclick = () => this.downloadFileById(fileInfo.id);
            li.appendChild(btn);
        } else {
            const btn = document.createElement('button');
            btn.className = 'btn btn-small btn-danger';
            btn.innerHTML = '<i class="fa-solid fa-trash"></i> Remove';
            btn.title = 'Remove file';
            btn.onclick = () => this.removeFile(fileInfo.id);
            li.appendChild(btn);
        }

        list.appendChild(li);
    }

    removeFile(fileId) {
        this.files = this.files.filter(f => f.id !== fileId);
        const li = document.querySelector(`[data-file-id="${fileId}"]`);
        if (li) li.remove();
        const list = document.getElementById('fileList');
        if (list && list.children.length === 0) {
            list.innerHTML = '<li class="empty">No files shared yet</li>';
        }
        this.updateFileCount();
    }

    enableDownloadButton(fileId) {
        const li = document.querySelector(`[data-file-id="${fileId}"]`);
        if (!li) return;
        const btn = li.querySelector('.download-btn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-download"></i> Download';
            btn.title = 'Download file';
        }
    }

    downloadFileById(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file || !file.data) return;
        const a = document.createElement('a');
        a.href = file.data;
        a.download = file.name;
        a.click();
    }

    receiveFileData(data) {
        const file = this.files.find(f => f.id === data.fileId);
        if (file) {
            file.data = data.data;
            this.enableDownloadButton(data.fileId);
        }
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
        if (fileCount) fileCount.textContent = this.files.length;
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
            senderId: this.p2p?.localId || 'unknown',
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

    // ========== UI Helpers ==========
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabName + 'Tab')?.classList.add('active');
    }

    toggleSection(sectionId) {
        if (window.innerWidth <= 640) {
            const section = document.getElementById(sectionId);
            if (section) section.classList.toggle('expanded');
        }
    }

    // ========== QR Code ==========
    
    showQRCode() {
        const modal = document.getElementById('qrModal');
        const container = document.getElementById('qrCodeContainer');
        const codeDisplay = document.getElementById('qrRoomCode');

        if (!modal || !container || !this.roomId) return;
        container.innerHTML = '';

        try {
            const qrWrapper = document.createElement('div');
            qrWrapper.style.cssText = 'background:white;padding:2rem;border-radius:1rem;display:inline-block;';
            container.appendChild(qrWrapper);

            // --- THE FIX ---
            // Grab the IP hint we sent from Python (?ip=10.255.x.x)
            const urlParams = new URLSearchParams(window.location.search);
            const lanIpHint = urlParams.get('ip');
            
            let qrOrigin;

            // If we are on localhost but have a LAN IP hint, use the hint for the QR
            if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && lanIpHint) {
                qrOrigin = `http://${lanIpHint}:8000`;
            } else {
                // Otherwise, just use the current browser origin
                qrOrigin = window.location.origin;
            }

            const roomUrl = qrOrigin + window.location.pathname + '?room=' + this.roomId;
            // ----------------

            console.log("🚀 QR Code generating for:", roomUrl);

            new QRCode(qrWrapper, {
                text: roomUrl,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            codeDisplay.textContent = this.roomId;
            modal.classList.remove('hidden');
        } catch (error) {
            console.error('QR error:', error);
            modal.classList.remove('hidden');
        }
    }

    hideQRCode() {
        document.getElementById('qrModal')?.classList.add('hidden');
    }

    // ========== QR Scanner ==========
    async showQRScanner() {
        const modal = document.getElementById('scannerModal');
        const reader = document.getElementById('qr-reader');
        if (!modal || !reader) return;

        modal.classList.remove('hidden');
        reader.innerHTML = "";

        if (typeof Html5Qrcode === 'undefined') {
            reader.innerHTML = '<div style="padding:2rem;text-align:center;color:#ef4444;">Scanner library not loaded</div>';
            return;
        }

        try {
            if (this.qrScanner) {
                try { await this.qrScanner.stop(); await this.qrScanner.clear(); } catch (e) {}
            }
            this.qrScanner = new Html5Qrcode("qr-reader");
            const devices = await Html5Qrcode.getCameras();
            if (!devices || devices.length === 0) throw new Error("No camera");

            let cameraId = devices[0].id;
            const backCam = devices.find(d => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"));
            if (backCam) cameraId = backCam.id;

            await this.qrScanner.start(
                cameraId,
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    console.log("✅ QR Scanned:", decodedText);
                    this.handleScannedQR(decodedText);
                    this.hideQRScanner();
                },
                () => {}
            );
        } catch (err) {
            console.error("Scanner error:", err);
            reader.innerHTML = `<div style="padding:2rem;text-align:center;color:#ef4444;"><p>Camera denied</p><button class="btn btn-secondary" onclick="app.useManualCode()">Enter Code Manually</button></div>`;
        }
    }

    async hideQRScanner() {
        document.getElementById('scannerModal')?.classList.add('hidden');
        if (this.qrScanner) {
            try { await this.qrScanner.stop(); await this.qrScanner.clear(); } catch (e) {}
        }
    }

    handleScannedQR(text) {
        this.hideQRScanner();
        let roomCode = text;
        if (text.includes('#join') || text.includes('?room=')) {
            try {
                const url = new URL(text);
                const hash = url.hash.replace('#', '');
                const params = new URLSearchParams(hash);
                roomCode = params.get('room') || roomCode;
            } catch (e) {}
        }
        roomCode = roomCode.match(/[A-Z0-9-]+/i)?.[0] || roomCode;
        
        const roomInput = document.getElementById('roomCode');
        const nameInput = document.getElementById('username');
        if (roomInput) {
            roomInput.value = roomCode.toUpperCase();
            if (nameInput && !nameInput.value) nameInput.value = 'Participant';
            this.showNotification(`✅ Room code filled: ${roomCode}`, 'success');
            setTimeout(() => { if (nameInput.value && roomInput.value) this.joinRoom(); }, 1000);
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
            this.showNotification('✅ Code copied!', 'success');
        } catch (e) {
            // Fallback: Create temp input and copy
            const temp = document.createElement('input');
            temp.value = this.roomId;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            this.showNotification('✅ Code copied!', 'success');
        }
    }

    showView(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none';
        });
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.add('active');
            target.style.display = viewId === 'landing' ? 'flex' : 'block';
            window.scrollTo(0, 0);
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        if (!container) return;
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
        notification.innerHTML = `<span class="icon">${icons[type] || icons.info}</span><span class="message">${message}</span>`;
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
                if (chatInput && document.activeElement === chatInput) this.sendChat();
            }

            // 2. NEW: Slide Navigation (Left/Right Arrows)
            // We check to make sure the user isn't currently typing in a text field
            const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            
            if (!isTyping) {
                if (e.key === 'ArrowRight' || e.key === ' ') {
                    e.preventDefault(); // Prevent page scroll on spacebar
                    this.nextSlide();
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.prevSlide();
                }
            }
        });
    }
}

// Initialize
const app = new DeskDockApp();
window.app = app;
console.log('🔗 DeskDock loaded successfully');

// Global confirm modal utility
window.showConfirm = function({ title, message, confirmText = 'OK', cancelText = 'Cancel', danger = false, onConfirm }) {
    const existing = document.getElementById('confirmModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal confirm-modal';
    modal.innerHTML = `
        <div class="modal-content confirm-modal-content">
            <h3 class="confirm-title">${title}</h3>
            <p class="confirm-message">${message}</p>
            <div class="confirm-actions">
                <button class="btn btn-secondary" id="confirmCancelBtn">${cancelText}</button>
                <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOkBtn">${confirmText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#confirmCancelBtn').onclick = close;
    modal.querySelector('#confirmOkBtn').onclick = () => { close(); onConfirm(); };
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
};
