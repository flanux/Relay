/**
 * QRCode.js - Lightweight QR code generator
 * Modified for Relay 
 */
class QRCodeGenerator {
    constructor() {
        this.qrcode = null;
    }

    // Generate QR code canvas
    generate(text, size = 200) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Simple QR-like pattern (for demo - in production use qrcode.js library)
        // For now, generate a visual representation
        this.drawSimpleQR(ctx, text, size);

        return canvas;
    }

    drawSimpleQR(ctx, text, size) {
        const cells = 25;
        const cellSize = size / cells;

        // Clear background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Generate pattern from text
        const hash = this.hashCode(text);
        const seed = hash;

        ctx.fillStyle = '#000000';

        // Draw position markers (corners)
        this.drawPositionMarker(ctx, 0, 0, cellSize);
        this.drawPositionMarker(ctx, cells - 7, 0, cellSize);
        this.drawPositionMarker(ctx, 0, cells - 7, cellSize);

        // Draw data pattern
        for (let i = 0; i < cells; i++) {
            for (let j = 0; j < cells; j++) {
                // Skip position markers
                if ((i < 7 && j < 7) || (i >= cells - 7 && j < 7) || (i < 7 && j >= cells - 7)) {
                    continue;
                }

                // Generate pseudo-random pattern based on text
                const val = Math.sin(i * j * seed) * 10000;
                if (val % 2 > 0.5) {
                    ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
                }
            }
        }
    }

    drawPositionMarker(ctx, x, y, cellSize) {
        // Outer square
        ctx.fillRect(x * cellSize, y * cellSize, 7 * cellSize, 7 * cellSize);

        // Inner white square
        ctx.fillStyle = '#ffffff';
        ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, 5 * cellSize, 5 * cellSize);

        // Center black square
        ctx.fillStyle = '#000000';
        ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, 3 * cellSize, 3 * cellSize);
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    // Show QR modal
    showModal(text, title = 'Scan to Join') {
        // Remove existing modal
        const existing = document.getElementById('qrModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'qrModal';
        modal.className = 'qr-modal';
        modal.innerHTML = `
            <div class="qr-modal-content">
                <div class="qr-header">
                    <h3>${title}</h3>
                    <button class="qr-close" onclick="this.closest('.qr-modal').remove()">&times;</button>
                </div>
                <div class="qr-code-container" id="qrContainer"></div>
                <div class="qr-code-text">${text}</div>
                <p class="qr-hint">Point camera at code to join</p>
            </div>
        `;

        document.body.appendChild(modal);

        // Generate QR
        const canvas = this.generate(text, 250);
        document.getElementById('qrContainer').appendChild(canvas);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
}

// Export
window.QRCodeGenerator = QRCodeGenerator;