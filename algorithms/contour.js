/**
 * Contour method for image stroke
 * Based on tracing the outline of the image using marching squares algorithm
 */
/**
 * Get contours from image data
 * @param imageData - RGBA image data
 * @param width - Image width
 * @param height - Image height
 * @param opacityThreshold - Threshold for determining transparent pixels
 * @returns Array of contour points
 */
export function getContours(imageData, width, height, opacityThreshold = 100) {
    // Points to store the contour
    const contourPoints = [];
    // Function to check if a pixel is non-transparent (inside the image)
    const isInside = (x, y) => {
        if (x >= 0 && y >= 0 && x < width && y < height) {
            const idx = (y * width + x) * 4;
            return imageData[idx + 3] > opacityThreshold;
        }
        return false;
    };
    // Find first non-transparent pixel as a starting point
    let startX = -1;
    let startY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (imageData[idx + 3] > opacityThreshold) {
                startX = x;
                startY = y;
                break;
            }
        }
        if (startX !== -1)
            break;
    }
    if (startX === -1)
        return []; // No non-transparent pixels found
    // Trace the contour using Moore's neighbor tracing algorithm
    // Start with a point on the boundary
    let currentX = startX;
    let currentY = startY;
    // Find a transparent neighbor to determine we're on the edge
    let direction = 0; // 0: right, 1: down, 2: left, 3: up
    const dx = [1, 0, -1, 0];
    const dy = [0, 1, 0, -1];
    // Find the first boundary point
    for (let i = 0; i < 4; i++) {
        const nx = currentX + dx[i];
        const ny = currentY + dy[i];
        if (!isInside(nx, ny)) {
            // Found a boundary point
            direction = (i + 3) % 4; // Start checking from the left of the current direction
            break;
        }
    }
    // Start tracing
    const visited = new Set();
    const key = `${currentX},${currentY}`;
    visited.add(key);
    contourPoints.push({ x: currentX, y: currentY });
    let iterations = 0;
    const MAX_ITERATIONS = width * height; // Safety check
    while (iterations < MAX_ITERATIONS) {
        iterations++;
        // Try to move in clockwise direction from the current one
        let found = false;
        let count = 0;
        while (count < 8) { // Check all possible directions
            // Calculate the direction to check (clockwise)
            const checkDir = (direction + count) % 8;
            const checkDx = checkDir < 4 ? dx[checkDir] : dx[checkDir - 4];
            const checkDy = checkDir < 4 ? dy[checkDir] : dy[checkDir - 4];
            const nx = currentX + checkDx;
            const ny = currentY + checkDy;
            // Check if we found a boundary point (non-transparent with transparent neighbor)
            if (isInside(nx, ny)) {
                let isBoundary = false;
                for (let i = 0; i < 4; i++) {
                    const bx = nx + dx[i];
                    const by = ny + dy[i];
                    if (!isInside(bx, by)) {
                        isBoundary = true;
                        break;
                    }
                }
                if (isBoundary) {
                    const newKey = `${nx},${ny}`;
                    if (!visited.has(newKey) ||
                        (nx === startX && ny === startY && contourPoints.length > 2)) {
                        // Move to this point
                        currentX = nx;
                        currentY = ny;
                        visited.add(newKey);
                        contourPoints.push({ x: nx, y: ny });
                        direction = (checkDir + 5) % 8; // Turn 180 degrees to continue searching
                        found = true;
                        break;
                    }
                }
            }
            count++;
        }
        // If we can't find a new boundary point or we're back at the start
        if (!found || (currentX === startX && currentY === startY && contourPoints.length > 2)) {
            break;
        }
    }
    return contourPoints;
}
/**
 * Generate Figma vector path from contour points
 * @param points - Array of contour points
 * @returns Figma path data string
 */
export function pointsToFigmaPath(points) {
    if (points.length < 2)
        return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
    }
    // Close the path if the first and last points are close enough
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const distance = Math.sqrt(Math.pow(lastPoint.x - firstPoint.x, 2) +
        Math.pow(lastPoint.y - firstPoint.y, 2));
    if (distance < 5 || points.length > 50) {
        path += ' Z';
    }
    return path;
}
/**
 * Create stroke using contour method
 * @param imageData - RGBA image data
 * @param width - Image width
 * @param height - Image height
 * @param opacityThreshold - Threshold for opacity detection
 * @returns Array of contour points and Figma path data
 */
export function createContourStroke(imageData, width, height, opacityThreshold) {
    const points = getContours(imageData, width, height, opacityThreshold);
    const pathData = pointsToFigmaPath(points);
    return { points, pathData };
}
