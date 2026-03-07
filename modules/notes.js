/**
 * NotesManager - Shared notes system
 */
class NotesManager {
    constructor(p2p, storage) {
        this.p2p = p2p;
        this.storage = storage;
        this.isHost = false;
        this.saveTimeout = null;
        this.lastContent = '';
        this.textarea = null;
    }

    init(isHost) {
        this.isHost = isHost;
        
        const panelId = isHost ? 'notesPanel' : 'participantNotesPanel';
        const textareaId = isHost ? 'notesTextarea' : 'participantNotesTextarea';
        
        const panel = document.getElementById(panelId);
        this.textarea = document.getElementById(textareaId);

        if (!this.textarea) return;

        // Load saved notes
        this.loadNotes();

        if (isHost) {
            // Host can edit
            this.textarea.addEventListener('input', () => {
                this.handleInput();
            });
        } else {
            // Participants read-only
            this.textarea.readOnly = true;
        }
    }

    loadNotes() {
        if (!this.storage || !this.p2p.roomId || !this.textarea) return;

        const content = this.storage.getNotes(this.p2p.roomId);
        this.textarea.value = content;
        this.lastContent = content;
    }

    handleInput() {
        // Clear existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Debounce save
        this.saveTimeout = setTimeout(() => {
            this.saveNotes();
        }, 1000);
    }

    saveNotes() {
        if (!this.textarea) return;

        const content = this.textarea.value;
        
        // Don't save if content hasn't changed
        if (content === this.lastContent) return;

        this.lastContent = content;

        // Save locally
        if (this.storage && this.p2p.roomId) {
            this.storage.saveNotes(this.p2p.roomId, content);
        }

        // Broadcast to participants
        if (this.isHost) {
            this.p2p.broadcast({
                type: 'notes_update',
                content: content,
                timestamp: Date.now()
            });
        }

        this.showSaveStatus();
    }

    receiveUpdate(content) {
        if (!this.textarea || this.isHost) return;

        // Update textarea
        this.textarea.value = content;
        this.lastContent = content;

        // Save locally
        if (this.storage && this.p2p.roomId) {
            this.storage.saveNotes(this.p2p.roomId, content);
        }
    }

    clearNotes() {
        if (!this.isHost) return;

        if (!confirm('Clear all notes? This cannot be undone.')) {
            return;
        }

        this.textarea.value = '';
        this.lastContent = '';

        // Clear local storage
        if (this.storage && this.p2p.roomId) {
            this.storage.clearNotes(this.p2p.roomId);
        }

        // Broadcast clear
        this.p2p.broadcast({
            type: 'notes_cleared',
            timestamp: Date.now()
        });

        this.showSaveStatus('Notes cleared');
    }

    handleNotesCleared() {
        if (!this.textarea) return;

        this.textarea.value = '';
        this.lastContent = '';

        // Clear local storage
        if (this.storage && this.p2p.roomId) {
            this.storage.clearNotes(this.p2p.roomId);
        }
    }

    showSaveStatus(message = '✓ Saved') {
        const status = document.getElementById('notesSaveStatus');
        if (!status) return;

        status.textContent = message;
        status.style.opacity = '1';

        setTimeout(() => {
            status.style.opacity = '0';
        }, 2000);
    }

    toggle() {
        const panelId = this.isHost ? 'notesPanel' : 'participantNotesPanel';
        const panel = document.getElementById(panelId);
        
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }
}

// Export
window.NotesManager = NotesManager;
