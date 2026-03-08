/**
 * SourceManager - Multi-Source Switching System
 * 
 * Handles multiple presentation sources (screen share, PDFs, images)
 * and allows seamless switching between them during live teaching.
 * 
 * Architecture:
 * - Zero modification to existing modules (wrapper pattern)
 * - Event-driven (sources can be added/removed dynamically)
 * - P2P sync (all participants see the same active source)
 */

class SourceManager {
    constructor(p2p) {
        this.p2p = p2p;
        this.sources = new Map(); // id -> {type, data, metadata, timestamp}
        this.activeSourceId = null;
        this.listeners = {
            sourceRegistered: [],
            sourceActivated: [],
            sourceRemoved: []
        };
        
        // Feature flag - can disable if it breaks
        this.ENABLE_MULTI_SOURCE = true;
        
        console.log('✅ SourceManager initialized');
    }

    /**
     * Register a new source
     * @param {string} id - Unique identifier (e.g., 'screen-1', 'pdf-123')
     * @param {string} type - Source type ('screen', 'pptx', 'image')
     * @param {object} data - Source-specific data
     * @param {object} metadata - Display metadata (title, icon, etc.)
     */
    registerSource(id, type, data, metadata = {}) {
        if (!this.ENABLE_MULTI_SOURCE) {
            console.log('Multi-source disabled, skipping registration');
            return;
        }

        const source = {
            id,
            type,
            data,
            metadata: {
                title: metadata.title || this.getDefaultTitle(type),
                icon: metadata.icon || this.getDefaultIcon(type),
                timestamp: Date.now(),
                ...metadata
            }
        };

        this.sources.set(id, source);
        console.log(`📌 Source registered: ${id} (${type})`);

        // Emit event
        this.emit('sourceRegistered', source);

        // Broadcast to participants
        if (this.p2p) {
            this.p2p.broadcast({
                type: 'source_registered',
                source: {
                    id: source.id,
                    type: source.type,
                    metadata: source.metadata
                }
            });
        }

        // Auto-activate if it's the first source
        if (this.sources.size === 1 && type != 'screen') {
            this.activateSource(id);
        }

        return source;
    }

    /**
     * Activate a source (make it the displayed one)
     * @param {string} id - Source ID to activate
     */
    activateSource(id) {
        if (!this.ENABLE_MULTI_SOURCE) return;

        const source = this.sources.get(id);
        if (!source) {
            console.warn(`Source ${id} not found`);
            return false;
        }

        const previousId = this.activeSourceId;
        this.activeSourceId = id;

        console.log(`🎯 Source activated: ${id} (was: ${previousId || 'none'})`);

        // Emit event
        this.emit('sourceActivated', source, previousId);

        // Broadcast to participants
        if (this.p2p) {
            this.p2p.broadcast({
                type: 'source_activated',
                sourceId: id,
                sourceType: source.type,
                metadata: source.metadata
            });
        }

        return true;
    }

    /**
     * Activate source by index (for keyboard shortcuts)
     * @param {number} index - 0-based index
     */
    activateSourceByIndex(index) {
        const sourceIds = Array.from(this.sources.keys());
        if (index >= 0 && index < sourceIds.length) {
            return this.activateSource(sourceIds[index]);
        }
        return false;
    }

    /**
     * Remove a source
     * @param {string} id - Source ID to remove
     */
    removeSource(id) {
        if (!this.sources.has(id)) return false;

        const source = this.sources.get(id);
        this.sources.delete(id);

        console.log(`🗑️ Source removed: ${id}`);

        // If this was the active source, activate another one
        if (this.activeSourceId === id) {
            const remainingSources = Array.from(this.sources.keys());
            if (remainingSources.length > 0) {
                this.activateSource(remainingSources[0]);
            } else {
                this.activeSourceId = null;
            }
        }

        // Emit event
        this.emit('sourceRemoved', source);

        // Broadcast to participants
        if (this.p2p) {
            this.p2p.broadcast({
                type: 'source_removed',
                sourceId: id
            });
        }

        return true;
    }

    /**
     * Get the currently active source
     */
    getActiveSource() {
        return this.activeSourceId ? this.sources.get(this.activeSourceId) : null;
    }

    /**
     * Get all sources
     */
    getAllSources() {
        return Array.from(this.sources.values());
    }

    /**
     * Get source by ID
     */
    getSource(id) {
        return this.sources.get(id);
    }

    /**
     * Get sources by type
     */
    getSourcesByType(type) {
        return Array.from(this.sources.values()).filter(s => s.type === type);
    }

    /**
     * Event listener system
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    emit(event, ...args) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(...args));
        }
    }

    /**
     * Helper: Get default title for source type
     */
    getDefaultTitle(type) {
        const titles = {
            screen: 'Screen Share',
            pptx: 'Presentation',
            image: 'Images',
            pdf: 'PDF Document',
            video: 'Video'
        };
        return titles[type] || 'Source';
    }

    /**
     * Helper: Get default icon for source type
     */
    getDefaultIcon(type) {
        const icons = {
            screen: '🖥️',
            pptx: '📊',
            image: '🖼️',
            pdf: '📄',
            video: '🎥'
        };
        return icons[type] || '📌';
    }

    /**
     * Handle incoming messages from participants (when they become host)
     */
    handleMessage(peerId, data) {
        if (!this.ENABLE_MULTI_SOURCE) return;

        switch (data.type) {
            case 'source_registered':
                // Participant received notification about new source
                console.log(`📥 Source registered from host: ${data.source.id}`);
                break;

            case 'source_activated':
                // Participant needs to switch to this source
                console.log(`📥 Source activated from host: ${data.sourceId}`);
                break;

            case 'source_removed':
                // Participant needs to remove this source
                console.log(`📥 Source removed from host: ${data.sourceId}`);
                break;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.sources.clear();
        this.activeSourceId = null;
        this.listeners = {
            sourceRegistered: [],
            sourceActivated: [],
            sourceRemoved: []
        };
        console.log('🧹 SourceManager destroyed');
    }
}

// Export
window.SourceManager = SourceManager;
