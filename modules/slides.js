/**
 * SlideSync - Projector screen capture and synchronization
 * Allows teacher to share screen and students to capture slides
 */
class SlideSync {
    constructor(p2pManager) {
        this.p2p = p2pManager;
        this.isCapturing = false;
        this.videoStream = null;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.captureInterval = null;
        this.quality = 0.6; // JPEG quality (0-1)
        this.fps = 1; // Frames per second

        // Bind methods
        this.handleIncomingSlide = this.handleIncomingSlide.bind(this);

        // Listen for incoming slide data
        this.p2p.onMessage((peerId, data) => {
            if (data.type === 'slide') {
                this.handleIncomingSlide(data);
            }
        });
    }

    // Teacher: Start capturing screen
    async startCapture() {
        try {
            console.log('🎥 Starting screen capture...');

            // Request screen capture
            this.videoStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always",
                    displaySurface: "monitor"
                },
                audio: false
            });

            // Create video element to capture frames
            this.videoElement = document.createElement('video');
            this.videoElement.srcObject = this.videoStream;
            this.videoElement.autoplay = true;

            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.canvas.width = this.videoElement.videoWidth;
                    this.canvas.height = this.videoElement.videoHeight;
                    resolve();
                };
            });

            this.isCapturing = true;

            // Update UI
            const preview = document.getElementById('previewVideo');
            if (preview) {
                preview.srcObject = this.videoStream;
                preview.style.display = 'block';
                document.querySelector('.preview-container').classList.add('active');
            }

            // Notify students
            this.p2p.broadcast({
                type: 'projector-status',
                status: 'started',
                timestamp: Date.now()
            });

            // Start capture loop
            this.captureLoop();

            // Handle stream end (user stops sharing)
            this.videoStream.getVideoTracks()[0].onended = () => {
                this.stopCapture();
            };

            return true;
        } catch (err) {
            console.error('Screen capture failed:', err);
            alert('Could not capture screen. Please allow screen sharing permission.');
            return false;
        }
    }

    // Teacher: Stop capturing
    stopCapture() {
        console.log('🛑 Stopping screen capture');
        this.isCapturing = false;

        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }

        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }

        // Update UI
        const preview = document.getElementById('previewVideo');
        if (preview) {
            preview.style.display = 'none';
            document.querySelector('.preview-container').classList.remove('active');
        }

        // Notify students
        this.p2p.broadcast({
            type: 'projector-status',
            status: 'stopped',
            timestamp: Date.now()
        });
    }

    // Teacher: Capture and broadcast frame
    async captureLoop() {
        if (!this.isCapturing || !this.videoElement) return;

        try {
            // Draw video frame to canvas
            this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);

            // Convert to JPEG with compression
            const blob = await new Promise(resolve => {
                this.canvas.toBlob(resolve, 'image/jpeg', this.quality);
            });

            // Convert to base64 for sending
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result;

                // Broadcast to all students
                this.p2p.broadcast({
                    type: 'slide',
                    image: base64,
                    timestamp: Date.now(),
                    width: this.canvas.width,
                    height: this.canvas.height
                });
            };
            reader.readAsDataURL(blob);

        } catch (err) {
            console.error('Capture error:', err);
        }

        // Schedule next capture
        this.captureInterval = setTimeout(() => this.captureLoop(), 1000 / this.fps);
    }

    // Student: Handle incoming slide
    handleIncomingSlide(data) {
        const img = document.getElementById('liveSlide');
        const overlay = document.getElementById('slideOverlay');
        const badge = document.getElementById('liveBadge');

        if (img && data.image) {
            img.src = data.image;
            img.classList.add('active');

            if (overlay) overlay.style.display = 'none';
            if (badge) badge.classList.add('active');

            // Auto-save if enabled
            const autoSave = document.getElementById('autoSave');
            if (autoSave && autoSave.checked) {
                this.saveSlide(data.image, data.timestamp);
            }
        }
    }

    // Student: Save slide to IndexedDB
    async saveSlide(imageData, timestamp) {
        try {
            // Create thumbnail
            const thumbCanvas = document.createElement('canvas');
            const thumbCtx = thumbCanvas.getContext('2d');
            thumbCanvas.width = 320;
            thumbCanvas.height = 180;

            const img = new Image();
            img.onload = async () => {
                thumbCtx.drawImage(img, 0, 0, 320, 180);
                const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.3);

                // Convert base64 to blob for storage
                const response = await fetch(imageData);
                const blob = await response.blob();

                // Save to storage
                const storage = new SmartStorage();
                await storage.saveSlide(this.p2p.roomId, timestamp, blob, thumbnail);

                // Update UI
                this.addSlideToGallery(timestamp, thumbnail);

                // Show notification
                app.showNotification('Slide saved!', 'success');
            };
            img.src = imageData;
        } catch (err) {
            console.error('Failed to save slide:', err);
        }
    }

    // Student: Save current slide manually
    async saveCurrentSlide() {
        const img = document.getElementById('liveSlide');
        if (img && img.src && img.classList.contains('active')) {
            await this.saveSlide(img.src, Date.now());
        } else {
            app.showNotification('No slide to save', 'error');
        }
    }

    // Add slide thumbnail to gallery
    addSlideToGallery(timestamp, thumbnail) {
        const gallery = document.getElementById('slideGallery');
        if (!gallery) return;

        // Remove empty state if present
        const empty = gallery.querySelector('.empty-state');
        if (empty) empty.remove();

        const div = document.createElement('div');
        div.className = 'slide-thumb';
        div.innerHTML = `<img src="${thumbnail}" alt="Slide">`;
        div.onclick = () => this.downloadSlide(timestamp);

        gallery.prepend(div);

        // Update count
        const countEl = document.getElementById('slideCount');
        if (countEl) {
            countEl.textContent = gallery.children.length;
        }
    }

    // Download specific slide
    async downloadSlide(timestamp) {
        const storage = new SmartStorage();
        const slide = await storage.get('slides', timestamp);

        if (slide && slide.blob) {
            const url = URL.createObjectURL(slide.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `slide-${new Date(timestamp).toISOString().slice(0,19).replace(/:/g,'-')}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    // Download all slides as ZIP
    async downloadAllSlides() {
        const storage = new SmartStorage();
        const slides = await storage.getSlides(this.p2p.roomId);

        if (slides.length === 0) {
            app.showNotification('No slides to download', 'error');
            return;
        }

        // For now, download individually (could use JSZip library for actual ZIP)
        slides.forEach((slide, index) => {
            setTimeout(() => {
                this.downloadSlide(slide.timestamp);
            }, index * 500);
        });

        app.showNotification(`Downloading ${slides.length} slides...`, 'success');
    }

    // Load saved slides from storage
    async loadSavedSlides() {
        const storage = new SmartStorage();
        const slides = await storage.getSlides(this.p2p.roomId);

        slides.forEach(slide => {
            this.addSlideToGallery(slide.timestamp, slide.thumbnail);
        });
    }
}

// Export
window.SlideSync = SlideSync;