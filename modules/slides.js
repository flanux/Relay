/**
 * SlideSync - Screen sharing and slide capture manager
 */
class SlideSync {
    constructor(p2p, storage) {
        this.p2p = p2p;
        this.storage = storage;
        this.stream = null;
        this.isSharing = false;
        this.captureInterval = null;
        this.lastFrameTime = 0;
        this.frameRate = 2; // 2 fps for slide capture
        this.autoSave = false; // OFF by default
        this.lastSavedData = null; // Track to avoid duplicates
        this.autoSaveDebounce = null; // Debounce timer
        
        // Elements
        this.previewVideo = null;
        this.previewCanvas = null;
        this.liveSlideImg = null;
        this.participantCanvas = null;
        
        this.onSlideUpdateCallback = null;
    }

    async startScreenShare() {
        try {
            console.log('🎬 Requesting screen share...');
            
            // Check if mediaDevices is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error('Screen sharing not supported. Please use HTTPS or localhost (not IP address like 10.x.x.x)');
            }
            
            // Most basic call possible - no constraints
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });

            console.log('✅ Got stream:', this.stream);

            // Get elements
            this.previewVideo = document.getElementById('previewVideo');
            this.previewCanvas = document.getElementById('previewCanvas');
            const placeholder = document.getElementById('previewPlaceholder');
            
            console.log('📺 Elements:', {
                video: this.previewVideo,
                canvas: this.previewCanvas,
                placeholder: placeholder
            });
            
            if (!this.previewVideo) {
                console.error('❌ Preview video element not found!');
                throw new Error('Preview video element not found');
            }
            
            // Hide placeholder
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            // Show and setup video
            this.previewVideo.srcObject = this.stream;
            this.previewVideo.style.display = 'block';
            this.previewVideo.classList.add('active');
            
            console.log('🎥 Video element setup complete');
            
            // Play the video
            try {
                await this.previewVideo.play();
                console.log('▶️ Video playing');
            } catch (playError) {
                console.warn('Play error (might be ok):', playError);
            }

            // Start capturing
            this.isSharing = true;
            this.startCapture();
            
            console.log('📸 Capture started');

            // Handle stream end
            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                console.log('🛑 Stream ended');
                this.stopScreenShare();
            });

            console.log('✅✅✅ Screen sharing fully started!');
            return true;
            
        } catch (error) {
            console.error('💥 Screen share error:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            this.isSharing = false;
            
            // Clean up on error
            if (this.previewVideo) {
                this.previewVideo.srcObject = null;
                this.previewVideo.classList.remove('active');
            }
            
            throw error;
        }
    }

    stopScreenShare() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.previewVideo) {
            this.previewVideo.srcObject = null;
            this.previewVideo.classList.remove('active');
            document.getElementById('previewPlaceholder')?.classList.remove('hidden');
        }

        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }

        this.isSharing = false;
        console.log('❌ Screen sharing stopped');
    }

    startCapture() {
        this.captureInterval = setInterval(() => {
            if (this.isSharing && this.previewVideo && this.previewVideo.readyState === 4) {
                this.captureFrame();
            }
        }, 1000 / this.frameRate);
    }

    async captureFrame() {
        const now = Date.now();
        
        // Throttle frame rate
        if (now - this.lastFrameTime < (1000 / this.frameRate)) {
            return;
        }
        
        this.lastFrameTime = now;

        try {
            const canvas = this.previewCanvas || document.createElement('canvas');
            const video = this.previewVideo;

            // Set canvas size to video dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert to compressed JPEG
            const imageData = canvas.toDataURL('image/jpeg', 0.7);

            // Broadcast to all peers
            this.p2p.broadcast({
                type: 'slide_update',
                data: imageData,
                timestamp: now
            });

            // Callback for UI updates
            if (this.onSlideUpdateCallback) {
                this.onSlideUpdateCallback(imageData);
            }

        } catch (error) {
            console.error('Capture error:', error);
        }
    }

    receiveFrame(imageData) {
        // Display on participant's screen
        const liveSlide = document.getElementById('liveSlide');
        const overlay = document.getElementById('slideOverlay');
        const liveBadge = document.getElementById('liveBadge');

        if (liveSlide) {
            liveSlide.src = imageData;
            liveSlide.classList.add('active');
            
            if (overlay) {
                overlay.classList.add('hidden');
            }
            
            if (liveBadge) {
                liveBadge.classList.add('active');
            }

            // Auto-save if enabled AND data is different
            if (this.autoSave && imageData !== this.lastSavedData) {
                // Clear previous debounce
                if (this.autoSaveDebounce) {
                    clearTimeout(this.autoSaveDebounce);
                }
                
                // Wait 2 seconds of stability before saving
                this.autoSaveDebounce = setTimeout(() => {
                    this.saveSlide(imageData);
                    this.lastSavedData = imageData;
                }, 2000);
            }
        }
    }

    async saveSlide(imageData) {
        if (!this.storage || !this.p2p.roomId) return;

        try {
            const slideId = await this.storage.saveSlide(this.p2p.roomId, imageData);
            this.displaySavedSlide(slideId, imageData);
            return slideId;
        } catch (error) {
            console.error('Error saving slide:', error);
        }
    }

    displaySavedSlide(slideId, imageData) {
        const gallery = document.getElementById('slideGallery');
        if (!gallery) return;

        // Remove empty state
        const emptyState = gallery.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Create thumbnail
        const thumb = document.createElement('div');
        thumb.className = 'slide-thumbnail';
        thumb.dataset.slideId = slideId;
        
        const img = document.createElement('img');
        img.src = imageData;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove';
        removeBtn.textContent = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteSlide(slideId);
        };

        thumb.appendChild(img);
        thumb.appendChild(removeBtn);
        
        // Click to view full size
        thumb.onclick = () => {
            this.viewSlide(imageData);
        };

        gallery.appendChild(thumb);
        this.updateSlideCount();
    }

    deleteSlide(slideId) {
        if (!this.storage || !this.p2p.roomId) return;

        this.storage.deleteSlide(this.p2p.roomId, slideId);
        
        const thumb = document.querySelector(`[data-slide-id="${slideId}"]`);
        if (thumb) {
            thumb.remove();
        }

        this.updateSlideCount();
    }

    viewSlide(imageData) {
        // Create modal to view slide
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.zIndex = '10000';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 90vw; max-height: 90vh;">
                <div class="modal-header">
                    <h3>Slide Preview</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <img src="${imageData}" style="width: 100%; height: auto; border-radius: 0.5rem;">
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    loadSavedSlides() {
        if (!this.storage || !this.p2p.roomId) return;

        const slides = this.storage.getSlides(this.p2p.roomId);
        slides.forEach(slide => {
            this.displaySavedSlide(slide.id, slide.data);
        });
    }

    async downloadAllSlides() {
        if (!this.storage || !this.p2p.roomId) return;

        const slides = this.storage.getSlides(this.p2p.roomId);
        
        if (slides.length === 0) {
            alert('No slides to download');
            return;
        }

        // Download each slide
        slides.forEach((slide, index) => {
            const link = document.createElement('a');
            link.href = slide.data;
            link.download = `slide_${index + 1}.jpg`;
            link.click();
        });
    }

    updateSlideCount() {
        const savedCount = document.getElementById('savedCount');
        const slideCount = document.getElementById('slideCount');
        const gallery = document.getElementById('slideGallery');
        
        if (gallery) {
            const count = gallery.querySelectorAll('.slide-thumbnail').length;
            
            if (savedCount) {
                savedCount.textContent = count;
            }
            
            if (slideCount) {
                slideCount.textContent = count;
            }

            // Show empty state if no slides
            if (count === 0 && !gallery.querySelector('.empty-state')) {
                gallery.innerHTML = '<p class="empty-state">Saved slides appear here</p>';
            }
        }
    }

    setAutoSave(enabled) {
        this.autoSave = enabled;
    }

    onSlideUpdate(callback) {
        this.onSlideUpdateCallback = callback;
    }
}

// Export
window.SlideSync = SlideSync;
