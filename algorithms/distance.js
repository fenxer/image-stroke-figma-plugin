/**
 * Distance transform method for image stroke
 * Based on Meijster's algorithm for computing Euclidean distance
 */
/**
 * Compute Euclidean distance transform for binary image
 * @param binaryImage - Binary image (1 for non-transparent, 0 for transparent)
 * @param width - Image width
 * @param height - Image height
 * @returns Distance map array
 */
export function computeDistances(binaryImage, width, height) {
    // First phase
    const infinity = width + height;
    const b = binaryImage;
    const g = new Array(width * height);
    for (let x = 0; x < width; x++) {
        // Base cases
        if (b[x]) {
            g[x] = 0;
        }
        else {
            g[x] = infinity;
        }
        // Scan 1 - top to bottom
        for (let y = 1; y < height; y++) {
            if (b[x + y * width]) {
                g[x + y * width] = 0;
            }
            else {
                g[x + y * width] = 1 + g[x + (y - 1) * width];
            }
        }
        // Scan 2 - bottom to top
        for (let y = height - 2; y >= 0; y--) {
            if (g[x + (y + 1) * width] < g[x + y * width]) {
                g[x + y * width] = 1 + g[x + (y + 1) * width];
            }
        }
    }
    // Helper functions for Euclidean distance
    function EDTFunc(x, i, gi) {
        return (x - i) * (x - i) + gi * gi;
    }
    function EDTSep(i, u, gi, gu) {
        return Math.floor((u * u - i * i + gu * gu - gi * gi) / (2 * (u - i)));
    }
    // Second phase
    const dt = new Array(width * height);
    const s = new Array(width);
    const t = new Array(width);
    for (let y = 0; y < height; y++) {
        let q = 0;
        s[0] = 0;
        t[0] = 0;
        // Scan 3 - left to right
        for (let u = 1; u < width; u++) {
            while (q >= 0 && EDTFunc(t[q], s[q], g[s[q] + y * width]) > EDTFunc(t[q], u, g[u + y * width])) {
                q--;
            }
            if (q < 0) {
                q = 0;
                s[0] = u;
            }
            else {
                const w = 1 + EDTSep(s[q], u, g[s[q] + y * width], g[u + y * width]);
                if (w < width) {
                    q++;
                    s[q] = u;
                    t[q] = w;
                }
            }
        }
        // Scan 4 - right to left
        for (let u = width - 1; u >= 0; u--) {
            const d = EDTFunc(u, s[q], g[s[q] + y * width]);
            dt[u + y * width] = Math.floor(Math.sqrt(d));
            if (u === t[q]) {
                q--;
            }
        }
    }
    return dt;
}
/**
 * Convert RGBA image data to binary image based on alpha threshold
 * @param imageData - RGBA image data
 * @param width - Image width
 * @param height - Image height
 * @param alphaThreshold - Threshold for determining transparency
 * @returns Binary image array (1 for non-transparent, 0 for transparent)
 */
export function toBinaryImage(imageData, width, height, alphaThreshold = 5) {
    const binaryImage = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            binaryImage[y * width + x] = imageData[idx + 3] < alphaThreshold ? 0 : 1;
        }
    }
    return binaryImage;
}
/**
 * Create stroke using distance transform method
 * @param imageData - RGBA image data
 * @param width - Image width
 * @param height - Image height
 * @param strokeWidth - Width of the stroke
 * @param strokeColor - RGBA color array [r, g, b, a]
 * @param alphaThreshold - Threshold for determining transparency
 * @returns New RGBA image data with stroke applied
 */
export function createDistanceStroke(imageData, width, height, strokeWidth, strokeColor, alphaThreshold) {
    // Create a copy of the input image data
    const resultData = new Uint8Array(imageData);
    // Convert to binary image
    const binaryImage = toBinaryImage(imageData, width, height, alphaThreshold);
    // Compute distance transform
    const distances = computeDistances(binaryImage, width, height);
    // Apply stroke based on distance
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const distance = distances[y * width + x];
            // If distance is less than stroke width, apply stroke color
            if (distance > 0 && distance < strokeWidth) {
                resultData[idx] = strokeColor[0];
                resultData[idx + 1] = strokeColor[1];
                resultData[idx + 2] = strokeColor[2];
                resultData[idx + 3] = strokeColor[3];
            }
        }
    }
    return resultData;
}
