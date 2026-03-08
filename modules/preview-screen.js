/**
 * PreviewShareManager - Auto Screen Share Module
 * 
 * Automatically captures and shares the host preview area (#hostPreview)
 * whenever slides/PDFs/images are loaded. Participants see what the host sees.
 * 
 * Architecture:
 * - Uses HTML5 Canvas API to capture the preview area
 * - Streams canvas at 10 FPS for efficiency
 * - Auto-starts when first file loads, auto-stops when all sources removed
 * - Works alongside existing screen share (separate stream)
 */

class PreviewShareManager {
    constructor(sourceManager) {
        this.sourceManager = sourceManager;
        this.isSharing = false;
        this.stream = null;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.fps = 15; // 15 FPS - good balance between quality and performance
        this.frameInterval = 1000 / this.fps;
        this.lastFrameTime = 0;
        
        // Target elements
        this.previewContainer = null;
        this.previewVideo = null;
        this.liveSlide = null;
        
        console.log('✅ PreviewShareManager initialized');
        
        // Listen to source events
        if (this.sourceManager) {
            this.sourceManager.on('sourceRegistered', (source) => {
                if (['pptx', 'pdf', 'image'].includes(source.type)) {
                    this.startPreviewShare();
                }
            });
            
            this.sourceManager.on('sourceRemoved', () => {
                // Stop if no more file-based sources
                const hasFileSources = this.sourceManager.getAllSources()
                    .some(s => ['pptx', 'pdf', 'image'].includes(s.type));
                
                if (!hasFileSources) {
                    this.stopPreviewShare();
                }
            });
        }
    }

    /**
     * Initialize canvas and capture elements
     */
    initCanvas() {
        if (this.canvas) return; // Already initialized
        
        // Get preview elements
        this.previewContainer = document.getElementById('hostPreview');
        this.liveSlide = document.getElementById('liveSlide');
        
        if (!this.previewContainer) {
            console.error('Preview container not found');
            return false;
        }
        
        // Create off-screen canvas for capture
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { 
            alpha: false,
            willReadFrequently: true 
        });
        
        // Set canvas size to match preview container
        const rect = this.previewContainer.getBoundingClientRect();
        this.canvas.width = rect.width || 1280;
        this.canvas.height = rect.height || 720;
        
        console.log(`📐 Canvas initialized: ${this.canvas.width}x${this.canvas.height}`);
        return true;
    }

    /**
     * Start sharing the preview area
     */
    async startPreviewShare() {
        if (this.isSharing) {
            console.log('⚠️ Preview share already active');
            return;
        }
        
        console.log('🎬 Starting preview share...');
        
        // Initialize canvas
        if (!this.initCanvas()) {
            console.error('Failed to initialize canvas');
            return;
        }
        
        try {
            // Create stream from canvas
            this.stream = this.canvas.captureStream(this.fps);
            this.isSharing = true;
            
            // Start capture loop
            this.startCaptureLoop();
            
            // Set stream to preview video element (so host can see it too if needed)
            this.previewVideo = document.getElementById('previewVideo');
            if (this.previewVideo) {
                this.previewVideo.srcObject = this.stream;
                this.previewVideo.style.display = 'none'; // Keep hidden, we're just streaming
            }
            
            console.log('✅ Preview share started');
            
            // Notify participants about the new preview stream
            this.notifyPreviewStreamStarted();
            
        } catch (error) {
            console.error('❌ Failed to start preview share:', error);
            this.isSharing = false;
        }
    }

    /**
     * Stop sharing the preview area
     */
    stopPreviewShare() {
        if (!this.isSharing) return;
        
        console.log('🛑 Stopping preview share...');
        
        // Stop capture loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Stop stream tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Clear preview video
        if (this.previewVideo) {
            this.previewVideo.srcObject = null;
        }
        
        this.isSharing = false;
        console.log('✅ Preview share stopped');
        
        // Notify participants
        this.notifyPreviewStreamStopped();
    }

    /**
     * Capture loop - draws preview area to canvas at specified FPS
     */
    startCaptureLoop() {
        const captureFrame = (timestamp) => {
            if (!this.isSharing) return;
            
            // Throttle to desired FPS
            const elapsed = timestamp - this.lastFrameTime;
            
            if (elapsed >= this.frameInterval) {
                this.lastFrameTime = timestamp - (elapsed % this.frameInterval);
                this.capturePreviewToCanvas();
            }
            
            this.animationId = requestAnimationFrame(captureFrame);
        };
        
        this.animationId = requestAnimationFrame(captureFrame);
    }

    /**
     * Capture current preview state to canvas
     */
    capturePreviewToCanvas() {
        if (!this.ctx || !this.canvas) return;
        
        try {
            // Clear canvas
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw live slide if visible
            if (this.liveSlide && this.liveSlide.classList.contains('active')) {
                // Calculate aspect ratio fit
                const imgWidth = this.liveSlide.naturalWidth || this.liveSlide.width;
                const imgHeight = this.liveSlide.naturalHeight || this.liveSlide.height;
                
                if (imgWidth && imgHeight) {
                    const scale = Math.min(
                        this.canvas.width / imgWidth,
                        this.canvas.height / imgHeight
                    );
                    
                    const scaledWidth = imgWidth * scale;
                    const scaledHeight = imgHeight * scale;
                    const x = (this.canvas.width - scaledWidth) / 2;
                    const y = (this.canvas.height - scaledHeight) / 2;
                    
                    this.ctx.drawImage(this.liveSlide, x, y, scaledWidth, scaledHeight);
                }
            }
            
            // Alternative: Draw the entire preview container using html2canvas-like technique
            // This would capture nav arrows and overlays too, but requires more processing
            
        } catch (error) {
            console.error('Error capturing preview:', error);
        }
    }

    /**
     * Notify participants that preview stream has started
     */
    notifyPreviewStreamStarted() {
        // This would integrate with P2P to send video stream
        // For now, just log - integration requires extending WebRTC module
        console.log('📡 Preview stream available for broadcast');
        
        // The stream is available at this.stream
        // It can be added to RTCPeerConnection like regular screen share
    }

    /**
     * Notify participants that preview stream has stopped
     */
    notifyPreviewStreamStopped() {
        console.log('📡 Preview stream ended');
    }

    /**
     * Get current stream (for integration with WebRTC)
     */
    getStream() {
        return this.stream;
    }

    /**
     * Check if preview share is active
     */
    isActive() {
        return this.isSharing;
    }

    /**
     * Resize canvas (call when window resizes)
     */
    resize() {
        if (!this.canvas || !this.previewContainer) return;
        
        const rect = this.previewContainer.getBoundingClientRect();
        if (this.canvas.width !== rect.width || this.canvas.height !== rect.height) {
            this.canvas.width = rect.width || 1280;
            this.canvas.height = rect.height || 720;
            console.log(`📐 Canvas resized: ${this.canvas.width}x${this.canvas.height}`);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopPreviewShare();
        this.canvas = null;
        this.ctx = null;
        this.previewContainer = null;
        this.liveSlide = null;
        this.previewVideo = null;
        console.log('🧹 PreviewShareManager destroyed');
    }
}

// Export
window.PreviewShareManager = PreviewShareManager;
