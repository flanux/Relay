/**
 * OverlayControls - Floating control panel for screen sharing mode
 * 
 * ARCHITECTURE NOTES:
 * - Positioned WITHIN preview container, not fixed to viewport
 * - Does NOT appear in screen capture region
 * - Uses existing CSS classes
 * - Provides quick access to polls, notes, and navigation
 * - Mobile-friendly (min 44px touch targets)
 */

class OverlayControls {
    constructor(containerElement, callbacks) {
        this.container = containerElement;
        this.callbacks = callbacks || {};
        
        this.overlay = null;
        this.isVisible = false;
        this.isDragging = false;
        
        // Feature flag
        this.ENABLE_OVERLAY = true;
    }

    init() {
        if (!this.ENABLE_OVERLAY || !this.container) return;

        this.createOverlay();
        this.attachEventListeners();
        
        console.log('✅ OverlayControls initialized');
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'relay-overlay';
        this.overlay.id = 'relayOverlay';
        
        // Inline styles to avoid CSS conflicts and ensure proper positioning
        this.overlay.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 0.75rem;
            padding: 0.5rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            display: none;
            min-width: 200px;
        `;

        this.overlay.innerHTML = `
            <div class="overlay-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding: 0.25rem;">
                <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">QUICK ACTIONS</span>
                <button class="overlay-close" style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 1.2rem; padding: 0; width: 20px; height: 20px; line-height: 1;">×</button>
            </div>
            <div class="overlay-controls" style="display: flex; flex-direction: column; gap: 0.5rem;">
                <button class="overlay-btn" data-action="poll" style="
                    background: rgba(59, 130, 246, 0.2);
                    border: 1px solid rgba(59, 130, 246, 0.4);
                    color: #60a5fa;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                    min-height: 44px;
                " onmouseover="this.style.background='rgba(59, 130, 246, 0.3)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.2)'">
                    <span style="font-size: 1.2rem;">📊</span>
                    <span style="flex: 1; text-align: left;">Create Poll</span>
                </button>
                
                <button class="overlay-btn" data-action="notes" style="
                    background: rgba(168, 85, 247, 0.2);
                    border: 1px solid rgba(168, 85, 247, 0.4);
                    color: #c084fc;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                    min-height: 44px;
                " onmouseover="this.style.background='rgba(168, 85, 247, 0.3)'" onmouseout="this.style.background='rgba(168, 85, 247, 0.2)'">
                    <span style="font-size: 1.2rem;">📝</span>
                    <span style="flex: 1; text-align: left;">Toggle Notes</span>
                </button>
                
                <button class="overlay-btn" data-action="files" style="
                    background: rgba(34, 197, 94, 0.2);
                    border: 1px solid rgba(34, 197, 94, 0.4);
                    color: #4ade80;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                    min-height: 44px;
                " onmouseover="this.style.background='rgba(34, 197, 94, 0.3)'" onmouseout="this.style.background='rgba(34, 197, 94, 0.2)'">
                    <span style="font-size: 1.2rem;">📎</span>
                    <span style="flex: 1; text-align: left;">Share File</span>
                </button>
                
                <div style="border-top: 1px solid rgba(148, 163, 184, 0.2); margin: 0.25rem 0;"></div>
                
                <button class="overlay-btn" data-action="next" style="
                    background: rgba(100, 116, 139, 0.2);
                    border: 1px solid rgba(100, 116, 139, 0.4);
                    color: #94a3b8;
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                    min-height: 40px;
                " onmouseover="this.style.background='rgba(100, 116, 139, 0.3)'" onmouseout="this.style.background='rgba(100, 116, 139, 0.2)'">
                    <span>⏭️</span>
                    <span style="flex: 1; text-align: left; font-size: 0.8rem;">Next Slide</span>
                </button>
            </div>
        `;

        this.container.style.position = 'relative'; // Ensure container is positioned
        this.container.appendChild(this.overlay);
    }

    attachEventListeners() {
        if (!this.overlay) return;

        // Close button
        const closeBtn = this.overlay.querySelector('.overlay-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
            });
        }

        // Action buttons
        const buttons = this.overlay.querySelectorAll('.overlay-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                this.handleAction(action);
            });
        });

        // Make overlay draggable (for desktop)
        this.makeDraggable();
    }

    makeDraggable() {
        const header = this.overlay.querySelector('.overlay-header');
        if (!header) return;

        let startX, startY, initialX, initialY;

        header.style.cursor = 'move';

        header.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = this.overlay.getBoundingClientRect();
            const containerRect = this.container.getBoundingClientRect();
            initialX = rect.left - containerRect.left;
            initialY = rect.top - containerRect.top;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        const onMouseMove = (e) => {
            if (!this.isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            this.overlay.style.left = (initialX + dx) + 'px';
            this.overlay.style.top = (initialY + dy) + 'px';
            this.overlay.style.right = 'auto';
        };

        const onMouseUp = () => {
            this.isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }

    handleAction(action) {
        console.log('Overlay action:', action);

        switch (action) {
            case 'poll':
                if (this.callbacks.onCreatePoll) {
                    this.callbacks.onCreatePoll();
                } else {
                    this.showQuickPoll();
                }
                break;
            
            case 'notes':
                if (this.callbacks.onToggleNotes) {
                    this.callbacks.onToggleNotes();
                } else {
                    this.toggleNotesPanel();
                }
                break;
            
            case 'files':
                if (this.callbacks.onShareFile) {
                    this.callbacks.onShareFile();
                } else {
                    this.triggerFileShare();
                }
                break;
            
            case 'next':
                if (this.callbacks.onNextSlide) {
                    this.callbacks.onNextSlide();
                }
                break;
        }
    }

    showQuickPoll() {
        // Trigger poll creation - switch to polls tab
        const pollsTab = document.querySelector('[data-tab="polls"]');
        if (pollsTab) {
            pollsTab.click();
        }

        // Focus on poll question input
        setTimeout(() => {
            const questionInput = document.getElementById('pollQuestion');
            if (questionInput) {
                questionInput.focus();
                questionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }

    toggleNotesPanel() {
        // Use existing notes toggle functionality
        if (window.app && window.app.toggleNotes) {
            window.app.toggleNotes();
        }
    }

    triggerFileShare() {
        // Trigger file input click
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.click();
        }
    }

    show() {
        if (this.overlay) {
            this.overlay.style.display = 'block';
            this.isVisible = true;
        }
    }

    hide() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
            this.isVisible = false;
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    setVisibility(visible) {
        if (visible) {
            this.show();
        } else {
            this.hide();
        }
    }

    // Method to update "Next Slide" button visibility based on presentation mode
    updateSlideControl(isPresentationActive) {
        const nextBtn = this.overlay?.querySelector('[data-action="next"]');
        if (nextBtn) {
            nextBtn.style.display = isPresentationActive ? 'flex' : 'none';
        }
    }

    destroy() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
}

// Export
window.OverlayControls = OverlayControls;
