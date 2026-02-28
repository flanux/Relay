/**
 * SmartStorage - IndexedDB with automatic TTL cleanup
 * No server required, runs entirely in browser
 */
class SmartStorage {
    constructor() {
        this.db = null;
        this.DB_NAME = 'LANCollabHub';
        this.DB_VERSION = 1;
        this.CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
        this.DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

        this.init();
    }

    async init() {
        try {
            this.db = await this.openDB();
            console.log('✓ Storage initialized');
            this.startCleanupLoop();
        } catch (err) {
            console.error('Storage init failed:', err);
        }
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Rooms store with expiration
                if (!db.objectStoreNames.contains('rooms')) {
                    const roomStore = db.createObjectStore('rooms', { keyPath: 'id' });
                    roomStore.createIndex('expires', 'expires', { unique: false });
                    roomStore.createIndex('lastActivity', 'lastActivity', { unique: false });
                }

                // Files store (blobs)
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'id' });
                    fileStore.createIndex('roomId', 'roomId', { unique: false });
                    fileStore.createIndex('expires', 'expires', { unique: false });
                }

                // Slides store (captured from projector)
                if (!db.objectStoreNames.contains('slides')) {
                    const slideStore = db.createObjectStore('slides', { keyPath: 'timestamp' });
                    slideStore.createIndex('roomId', 'roomId', { unique: false });
                }

                // Polls store
                if (!db.objectStoreNames.contains('polls')) {
                    db.createObjectStore('polls', { keyPath: 'id' });
                }

                // Messages store
                if (!db.objectStoreNames.contains('messages')) {
                    const msgStore = db.createObjectStore('messages', { keyPath: 'timestamp' });
                    msgStore.createIndex('roomId', 'roomId', { unique: false });
                }
            };
        });
    }

    // Auto-cleanup loop - runs in browser, no server needed!
    startCleanupLoop() {
        // Run immediately
        this.cleanup();

        // Then every 5 minutes
        setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);

        // Also run when tab becomes visible (user returns)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.cleanup();
        });
    }

    async cleanup() {
        if (!this.db) return;

        const now = Date.now();
        let cleaned = 0;

        try {
            // Clean expired rooms
            const roomTx = this.db.transaction('rooms', 'readwrite');
            const roomStore = roomTx.objectStore('rooms');
            const roomIndex = roomStore.index('expires');

            const rooms = await roomIndex.openCursor(IDBKeyRange.upperBound(now));
            rooms.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    console.log('🗑️ Auto-deleting expired room:', cursor.value.id);
                    roomStore.delete(cursor.primaryKey);
                    cleaned++;
                    cursor.continue();
                }
            };

            // Clean expired files
            const fileTx = this.db.transaction('files', 'readwrite');
            const fileStore = fileTx.objectStore('files');
            const fileIndex = fileStore.index('expires');

            const files = await fileIndex.openCursor(IDBKeyRange.upperBound(now));
            files.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    console.log('🗑️ Auto-deleting expired file:', cursor.value.name);
                    fileStore.delete(cursor.primaryKey);
                    cleaned++;
                    cursor.continue();
                }
            };

            if (cleaned > 0) {
                console.log(`✓ Cleanup complete: removed ${cleaned} expired items`);
            }
        } catch (err) {
            console.error('Cleanup error:', err);
        }
    }

    // Generic CRUD operations
    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName, indexName, query) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const source = indexName ? store.index(indexName) : store;
            const request = query ? source.openCursor(query) : source.openCursor();

            const results = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Room-specific methods
    async saveRoom(roomId, data, ttlHours = 24) {
        const expires = Date.now() + (ttlHours * 60 * 60 * 1000);
        await this.put('rooms', {
            id: roomId,
            data: data,
            created: Date.now(),
            lastActivity: Date.now(),
            expires: expires
        });
    }

    async getRoom(roomId) {
        const room = await this.get('rooms', roomId);
        if (room && room.expires > Date.now()) {
            return room;
        }
        return null;
    }

    async updateRoomActivity(roomId) {
        const room = await this.get('rooms', roomId);
        if (room) {
            room.lastActivity = Date.now();
            // Extend expiration on activity
            room.expires = Date.now() + (24 * 60 * 60 * 1000);
            await this.put('rooms', room);
        }
    }

    async deleteRoom(roomId) {
        // Delete room and all associated data
        await this.delete('rooms', roomId);

        // Delete associated files
        const files = await this.getAll('files', 'roomId', IDBKeyRange.only(roomId));
        for (const file of files) {
            await this.delete('files', file.id);
        }

        // Delete associated slides
        const slides = await this.getAll('slides', 'roomId', IDBKeyRange.only(roomId));
        for (const slide of slides) {
            await this.delete('slides', slide.timestamp);
        }

        console.log('🗑️ Room and all data deleted:', roomId);
    }

    // File methods
    async saveFile(fileId, roomId, blob, metadata) {
        const expires = Date.now() + (24 * 60 * 60 * 1000); // 24h
        await this.put('files', {
            id: fileId,
            roomId: roomId,
            blob: blob,
            metadata: metadata,
            created: Date.now(),
            expires: expires
        });
    }

    async getFile(fileId) {
        return await this.get('files', fileId);
    }

    async getRoomFiles(roomId) {
        return await this.getAll('files', 'roomId', IDBKeyRange.only(roomId));
    }

    // Slide methods
    async saveSlide(roomId, timestamp, blob, thumbnail) {
        await this.put('slides', {
            timestamp: timestamp,
            roomId: roomId,
            blob: blob,
            thumbnail: thumbnail,
            savedAt: Date.now()
        });
    }

    async getSlides(roomId) {
        const slides = await this.getAll('slides', 'roomId', IDBKeyRange.only(roomId));
        return slides.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Message methods
    async saveMessage(roomId, message) {
        await this.put('messages', {
            timestamp: Date.now(),
            roomId: roomId,
            ...message
        });
    }

    async getMessages(roomId, since = 0) {
        const messages = await this.getAll('messages', 'roomId', IDBKeyRange.only(roomId));
        return messages.filter(m => m.timestamp > since).sort((a, b) => a.timestamp - b.timestamp);
    }

    // Stats
    async getStats() {
        const rooms = await this.getAll('rooms');
        const files = await this.getAll('files');
        const slides = await this.getAll('slides');

        return {
            rooms: rooms.length,
            files: files.length,
            slides: slides.length,
            storageUsed: 'Calculating...' // Could add size calculation
        };
    }
}

// Export for use in other modules
window.SmartStorage = SmartStorage;