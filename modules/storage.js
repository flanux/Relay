/**
 * SmartStorage - Local storage management for Relay
 */
class SmartStorage {
    constructor() {
        this.prefix = 'relay_';
    }

    // Save room info
    async saveRoom(roomId, data) {
        const key = this.prefix + 'room_' + roomId;
        localStorage.setItem(key, JSON.stringify({
            ...data,
            timestamp: Date.now()
        }));
    }

    // Get room info
    getRoom(roomId) {
        const key = this.prefix + 'room_' + roomId;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    // Save slide
    async saveSlide(roomId, imageData) {
        const slides = this.getSlides(roomId);
        const slideId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        slides.push({
            id: slideId,
            data: imageData,
            timestamp: Date.now()
        });

        const key = this.prefix + 'slides_' + roomId;
        localStorage.setItem(key, JSON.stringify(slides));
        
        return slideId;
    }

    // Get all slides for a room
    getSlides(roomId) {
        const key = this.prefix + 'slides_' + roomId;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    }

    // Delete a slide
    deleteSlide(roomId, slideId) {
        const slides = this.getSlides(roomId);
        const filtered = slides.filter(s => s.id !== slideId);
        const key = this.prefix + 'slides_' + roomId;
        localStorage.setItem(key, JSON.stringify(filtered));
    }

    // Clear all slides for a room
    clearSlides(roomId) {
        const key = this.prefix + 'slides_' + roomId;
        localStorage.removeItem(key);
    }

    // Save notes
    saveNotes(roomId, content) {
        const key = this.prefix + 'notes_' + roomId;
        localStorage.setItem(key, content);
    }

    // Get notes
    getNotes(roomId) {
        const key = this.prefix + 'notes_' + roomId;
        return localStorage.getItem(key) || '';
    }

    // Clear notes
    clearNotes(roomId) {
        const key = this.prefix + 'notes_' + roomId;
        localStorage.removeItem(key);
    }

    // Get storage usage
    getUsageBytes() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key) && key.startsWith(this.prefix)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total;
    }

    // Clear old rooms (older than 7 days)
    cleanupOldRooms() {
        const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key) && key.startsWith(this.prefix + 'room_')) {
                const data = JSON.parse(localStorage[key]);
                if (data.timestamp && data.timestamp < cutoff) {
                    const roomId = key.replace(this.prefix + 'room_', '');
                    localStorage.removeItem(key);
                    localStorage.removeItem(this.prefix + 'slides_' + roomId);
                    localStorage.removeItem(this.prefix + 'notes_' + roomId);
                }
            }
        }
    }
}

// Export
window.SmartStorage = SmartStorage;
