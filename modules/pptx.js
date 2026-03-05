/**
 * PPTXRenderer - PowerPoint file upload and slide presentation manager
 * 
 * ARCHITECTURE NOTES:
 * - Extends existing SlideSync, never replaces it
 * - Uses composition, not inheritance
 * - All slides stored as compressed JPEG data URLs
 * - Broadcasts via existing P2P mesh (p2p.broadcast)
 * - Respects offline-first constraint
 */

class PPTXRenderer {
    constructor(p2p, storage, slideSync) {
        this.p2p = p2p;
        this.storage = storage;
        this.slideSync = slideSync; // Reuse existing broadcast pipeline
        
        this.slides = []; // Array of {index, imageData, title}
        this.currentSlideIndex = 0;
        this.isPresentationMode = false;
        this.presentationStartTime = null;
        
        // UI Elements
        this.uploadBtn = null;
        this.slideCounter = null;
        this.slideViewer = null;
        
        // Feature flag
        this.ENABLE_PPTX = true;
    }

    init() {
        if (!this.ENABLE_PPTX) return;
        
        // Attach to the file input in header (already exists in HTML)
        const fileInput = document.getElementById('pptxFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
        }

        console.log('✅ PPTXRenderer initialized');
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        if (window.app) {
            window.app.showNotification('⏳ Processing files...', 'info');
        }

        try {
            // Process each file as a slide
            const fileArray = Array.from(files);
            
            // Sort files by name to maintain order
            fileArray.sort((a, b) => a.name.localeCompare(b.name));

            this.slides = []; // Clear existing slides
            let slideIndex = 0;

            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                
                // Validate file type
                if (!this.isValidSlideFile(file)) {
                    console.warn(`Skipping invalid file: ${file.name}`);
                    continue;
                }

                // Convert file to data URL(s)
                const imageData = await this.fileToDataURL(file);
                
                // Handle PDF (returns array) vs images (returns single)
                if (Array.isArray(imageData)) {
                    // PDF returned multiple pages
                    for (let pageData of imageData) {
                        const compressedData = await this.compressImage(pageData, 0.7);
                        this.slides.push({
                            index: slideIndex++,
                            imageData: compressedData,
                            title: `${file.name} - Page ${slideIndex}`
                        });
                    }
                } else {
                    // Single image file
                    const compressedData = await this.compressImage(imageData, 0.7);
                    this.slides.push({
                        index: slideIndex++,
                        imageData: compressedData,
                        title: file.name.replace(/\.[^/.]+$/, '') // Remove extension
                    });
                }
            }

            if (this.slides.length === 0) {
                if (window.app) {
                    window.app.showNotification('❌ No valid slides found', 'error');
                }
                return;
            }

            if (window.app) {
                window.app.showNotification(`✅ Loaded ${this.slides.length} slide(s)`, 'success');
            }
            
            // Broadcast to participants
            this.broadcastSlides();

            // Show presentation controls
            this.showPresentationControls();

            // Auto-start presentation mode
            this.startPresentation();

        } catch (error) {
            console.error('Error processing files:', error);
            if (window.app) {
                window.app.showNotification('❌ ' + error.message, 'error');
            }
        }
    }

    isValidSlideFile(file) {
        const validTypes = [
            'image/png', 
            'image/jpeg', 
            'image/jpg', 
            'image/webp', 
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
            'application/vnd.ms-powerpoint' // .ppt
        ];
        
        // Also check file extension for PPTX (some browsers don't set MIME type correctly)
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
            return true;
        }
        
        return validTypes.includes(file.type);
    }

    async fileToDataURL(file) {
        const fileName = file.name.toLowerCase();
        
        if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
            // Handle PDF files
            return await this.processPDF(file);
        } else if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
            // Handle PowerPoint files
            return await this.processPPTX(file);
        } else {
            // Handle image files
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    }

    async processPPTX(file) {
        try {
            throw new Error('PowerPoint files (.pptx) need to be converted to PDF or images first. In PowerPoint: File → Export → PDF or Save as Images (PNG/JPG)');
        } catch (error) {
            throw error;
        }
    }

    async processPDF(file) {
        try {
            // Load PDF.js library dynamically if not already loaded
            if (!window.pdfjsLib) {
                await this.loadPDFJS();
            }

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            // Process all pages
            const slides = [];
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2.0 });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                slides.push(canvas.toDataURL('image/jpeg', 0.8));
            }
            
            return slides; // Return array of images
        } catch (error) {
            console.error('PDF processing error:', error);
            throw new Error('Failed to process PDF: ' + error.message);
        }
    }

    async loadPDFJS() {
        return new Promise((resolve, reject) => {
            if (window.pdfjsLib) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js'));
            document.head.appendChild(script);
        });
    }

    async compressImage(dataURL, quality = 0.7) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                
                // Limit max dimensions to prevent memory issues
                const MAX_WIDTH = 1920;
                const MAX_HEIGHT = 1080;
                
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height = (height * MAX_WIDTH) / width;
                    width = MAX_WIDTH;
                }
                if (height > MAX_HEIGHT) {
                    width = (width * MAX_HEIGHT) / height;
                    height = MAX_HEIGHT;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress as JPEG
                const compressed = canvas.toDataURL('image/jpeg', quality);
                resolve(compressed);
            };
            img.src = dataURL;
        });
    }

    broadcastSlides() {
        // Send slide metadata to all participants
        this.p2p.broadcast({
            type: 'pptx_loaded',
            slides: this.slides.map(s => ({
                index: s.index,
                imageData: s.imageData,
                title: s.title
            })),
            currentIndex: 0
        });
    }

    handleSlidesReceived(data) {
        // Participant receives slides
        this.slides = data.slides;
        this.currentSlideIndex = data.currentIndex || 0;
        
        // Display first slide
        this.renderSlide(this.currentSlideIndex);
        
        // Show notification
        if (window.app) {
            window.app.showNotification(`📊 Presentation loaded (${this.slides.length} slides)`, 'success');
        }
    }

    showPresentationControls() {
        // Add controls to stats bar instead of inside card
        const statsBar = document.querySelector('.stats-bar');
        if (!statsBar) return;

        // Remove existing presentation controls if any
        const existing = document.getElementById('presentationControls');
        if (existing) existing.remove();

        // Create compact controls in stats bar
        const controls = document.createElement('div');
        controls.id = 'presentationControls';
        controls.style.cssText = `
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0 1rem;
            border-left: 1px solid var(--border);
            margin-left: auto;
        `;
        
        controls.innerHTML = `
            <span id="slideCounter" style="font-size: 0.9rem; color: #94a3b8; font-weight: 600;">1 / ${this.slides.length}</span>
            <button class="btn btn-danger btn-small" onclick="pptxRenderer.endPresentation()">
                Stop Presentation
            </button>
        `;

        statsBar.appendChild(controls);
        this.slideCounter = document.getElementById('slideCounter');

        // Setup keyboard navigation
        this.setupKeyboardNav();
        
        // Add navigation arrows to preview
        this.addNavigationArrows();
    }

    addNavigationArrows() {
        const previewContainer = document.getElementById('hostPreview');
        if (!previewContainer) return;

        // Remove existing arrows
        const existingLeft = document.getElementById('navArrowLeft');
        const existingRight = document.getElementById('navArrowRight');
        if (existingLeft) existingLeft.remove();
        if (existingRight) existingRight.remove();

        // Left arrow
        const leftArrow = document.createElement('div');
        leftArrow.id = 'navArrowLeft';
        leftArrow.innerHTML = '←';
        leftArrow.style.cssText = `
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 60px;
            height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
            color: rgba(255, 255, 255, 0.7);
            background: linear-gradient(to right, rgba(0, 0, 0, 0.5), transparent);
            cursor: pointer;
            z-index: 100;
            transition: all 0.2s;
            user-select: none;
        `;
        leftArrow.onmouseenter = () => {
            leftArrow.style.color = 'rgba(255, 255, 255, 1)';
            leftArrow.style.background = 'linear-gradient(to right, rgba(0, 0, 0, 0.7), transparent)';
        };
        leftArrow.onmouseleave = () => {
            leftArrow.style.color = 'rgba(255, 255, 255, 0.7)';
            leftArrow.style.background = 'linear-gradient(to right, rgba(0, 0, 0, 0.5), transparent)';
        };
        leftArrow.onclick = () => this.previousSlide();

        // Right arrow
        const rightArrow = document.createElement('div');
        rightArrow.id = 'navArrowRight';
        rightArrow.innerHTML = '→';
        rightArrow.style.cssText = `
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 60px;
            height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
            color: rgba(255, 255, 255, 0.7);
            background: linear-gradient(to left, rgba(0, 0, 0, 0.5), transparent);
            cursor: pointer;
            z-index: 100;
            transition: all 0.2s;
            user-select: none;
        `;
        rightArrow.onmouseenter = () => {
            rightArrow.style.color = 'rgba(255, 255, 255, 1)';
            rightArrow.style.background = 'linear-gradient(to left, rgba(0, 0, 0, 0.7), transparent)';
        };
        rightArrow.onmouseleave = () => {
            rightArrow.style.color = 'rgba(255, 255, 255, 0.7)';
            rightArrow.style.background = 'linear-gradient(to left, rgba(0, 0, 0, 0.5), transparent)';
        };
        rightArrow.onclick = () => this.nextSlide();

        previewContainer.appendChild(leftArrow);
        previewContainer.appendChild(rightArrow);
    }

    setupKeyboardNav() {
        // Remove existing listener if any
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }

        this.keyboardHandler = (e) => {
            if (!this.isPresentationMode) return;
            
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                this.nextSlide();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.previousSlide();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.endPresentation();
            }
        };

        document.addEventListener('keydown', this.keyboardHandler);
    }

    startPresentation() {
        this.isPresentationMode = true;
        this.presentationStartTime = Date.now();
        this.currentSlideIndex = 0;
        
        // Override SlideSync to show our slides instead of screen capture
        this.renderSlide(0);
        this.broadcastSlideChange(0);
    }

    renderSlide(index) {
        if (index < 0 || index >= this.slides.length) return;

        this.currentSlideIndex = index;
        const slide = this.slides[index];

        // Check if screen sharing is active - DON'T interfere!
        if (this.slideSync && this.slideSync.isSharing) {
            console.log('Screen sharing is active, not rendering slide over it');
            return;
        }

        // Update preview video/canvas area to show slide
        const previewVideo = document.getElementById('previewVideo');
        const previewPlaceholder = document.getElementById('previewPlaceholder');
        const previewCanvas = document.getElementById('previewCanvas');
        
        // ONLY hide video if we're actually in presentation mode
        if (this.isPresentationMode) {
            if (previewVideo) {
                previewVideo.classList.remove('active');
                previewVideo.style.display = 'none';
            }
            if (previewCanvas) {
                previewCanvas.style.display = 'none';
            }
        }
        
        if (previewPlaceholder) {
            previewPlaceholder.classList.remove('hidden');
            previewPlaceholder.style.display = 'flex';
            previewPlaceholder.innerHTML = `
                <img src="${slide.imageData}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 0.5rem;">
            `;
        }

        // Update counter
        if (this.slideCounter) {
            this.slideCounter.textContent = `${index + 1} / ${this.slides.length}`;
        }

        // For participants - update liveSlide image
        const liveSlide = document.getElementById('liveSlide');
        if (liveSlide) {
            liveSlide.src = slide.imageData;
            liveSlide.classList.add('active');
            
            const overlay = document.getElementById('slideOverlay');
            if (overlay) overlay.classList.add('hidden');
            
            const liveBadge = document.getElementById('liveBadge');
            if (liveBadge) liveBadge.classList.add('active');
        }
    }

    nextSlide() {
        if (this.currentSlideIndex < this.slides.length - 1) {
            const newIndex = this.currentSlideIndex + 1;
            this.renderSlide(newIndex);
            this.broadcastSlideChange(newIndex);
        }
    }

    previousSlide() {
        if (this.currentSlideIndex > 0) {
            const newIndex = this.currentSlideIndex - 1;
            this.renderSlide(newIndex);
            this.broadcastSlideChange(newIndex);
        }
    }

    broadcastSlideChange(index) {
        this.p2p.broadcast({
            type: 'slide_advance',
            index: index
        });
    }

    handleSlideAdvance(data) {
        // Participant receives slide change
        this.renderSlide(data.index);
    }

    endPresentation() {
        this.isPresentationMode = false;
        
        // Restore preview elements properly
        const previewPlaceholder = document.getElementById('previewPlaceholder');
        const previewVideo = document.getElementById('previewVideo');
        const previewCanvas = document.getElementById('previewCanvas');
        
        if (previewPlaceholder) {
            previewPlaceholder.classList.remove('hidden');
            previewPlaceholder.style.display = 'flex';
            previewPlaceholder.innerHTML = `
                <span class="icon">🖥️</span>
                <p>Click "Start Sharing" to begin</p>
            `;
        }
        
        if (previewVideo) {
            previewVideo.style.display = 'block';
        }
        
        if (previewCanvas) {
            previewCanvas.style.display = 'block';
        }

        // Remove controls
        const controls = document.getElementById('presentationControls');
        if (controls) controls.remove();

        // Remove navigation arrows
        const leftArrow = document.getElementById('navArrowLeft');
        const rightArrow = document.getElementById('navArrowRight');
        if (leftArrow) leftArrow.remove();
        if (rightArrow) rightArrow.remove();

        // Remove keyboard handler
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }

        // Notify participants
        this.p2p.broadcast({
            type: 'presentation_ended'
        });

        if (window.app) {
            window.app.showNotification('Presentation ended', 'info');
        }
    }

    handlePresentationEnded() {
        // Participant side cleanup
        const liveSlide = document.getElementById('liveSlide');
        if (liveSlide) {
            liveSlide.classList.remove('active');
        }
        
        const overlay = document.getElementById('slideOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        
        const liveBadge = document.getElementById('liveBadge');
        if (liveBadge) {
            liveBadge.classList.remove('active');
        }

        this.slides = [];
        this.currentSlideIndex = 0;
        this.isPresentationMode = false;
    }
}

// Export
window.PPTXRenderer = PPTXRenderer;
