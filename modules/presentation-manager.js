/**
 * PresentationManager - Proper architecture for multiple slide sources
 * 
 * Each presentation has its OWN:
 * - slides array
 * - currentSlide index
 * - metadata
 * 
 * NO shared state = NO race conditions!
 */

class PresentationManager {
    constructor() {
        this.presentations = new Map(); // id -> {slides, current, type, metadata}
        this.activeId = null;
    }

    /**
     * Create a new presentation
     */
    create(id, type, metadata = {}) {
        this.presentations.set(id, {
            id,
            type,
            slides: [],
            current: 0,
            metadata: {
                title: metadata.title || 'Untitled',
                icon: metadata.icon || '📄',
                ...metadata
            }
        });
        console.log(`✅ Presentation created: ${id} (${type})`);
        return this.presentations.get(id);
    }

    /**
     * Add a slide to a presentation
     */
    addSlide(id, slideData) {
        const pres = this.presentations.get(id);
        if (!pres) {
            console.error(`Presentation ${id} not found`);
            return;
        }
        
        pres.slides.push({
            index: pres.slides.length,
            data: slideData,
            timestamp: Date.now()
        });
    }

    /**
     * Set active presentation
     */
    setActive(id) {
        if (!this.presentations.has(id)) {
            console.error(`Presentation ${id} not found`);
            return false;
        }
        
        this.activeId = id;
        console.log(`🎯 Active presentation: ${id}`);
        return true;
    }

    /**
     * Get active presentation
     */
    getActive() {
        return this.activeId ? this.presentations.get(this.activeId) : null;
    }

    /**
     * Get current slide from active presentation
     */
    getCurrentSlide() {
        const active = this.getActive();
        if (!active || !active.slides.length) return null;
        
        return active.slides[active.current];
    }

    /**
     * Navigate active presentation
     */
    next() {
        const active = this.getActive();
        if (!active) return false;
        
        if (active.current < active.slides.length - 1) {
            active.current++;
            return true;
        }
        return false;
    }

    prev() {
        const active = this.getActive();
        if (!active) return false;
        
        if (active.current > 0) {
            active.current--;
            return true;
        }
        return false;
    }

    /**
     * Navigate to specific slide
     */
    goTo(index) {
        const active = this.getActive();
        if (!active) return false;
        
        if (index >= 0 && index < active.slides.length) {
            active.current = index;
            return true;
        }
        return false;
    }

    /**
     * Get all presentations
     */
    getAll() {
        return Array.from(this.presentations.values());
    }

    /**
     * Get presentation by ID
     */
    get(id) {
        return this.presentations.get(id);
    }

    /**
     * Remove presentation
     */
    remove(id) {
        const pres = this.presentations.get(id);
        if (pres) {
            this.presentations.delete(id);
            console.log(`🗑️ Presentation removed: ${id}`);
            
            // If we removed the active one, clear active
            if (this.activeId === id) {
                this.activeId = null;
            }
            return true;
        }
        return false;
    }

    /**
     * Clear all
     */
    clear() {
        this.presentations.clear();
        this.activeId = null;
    }
}

// Global instance
window.PresentationManager = PresentationManager;
