/**
 * Contour method for image stroke
 * Based on tracing the outline of the image using marching squares algorithm
 */

// Interface for point coordinates
interface Point {
  x: number;
  y: number;
}

// Helper to detect image content bounds (similar to distance.ts)
function detectActualImageBounds(
  imageData: Uint8Array,
  width: number,
  height: number,
  opacityThreshold: number
): { minX: number; minY: number; maxX: number; maxY: number; hasContent: boolean } {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (imageData[idx + 3] >= opacityThreshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hasContent = true;
      }
    }
  }
  if (!hasContent) return { minX: 0, minY: 0, maxX: 0, maxY: 0, hasContent: false };
  return { minX, minY, maxX, maxY, hasContent };
}

/**
 * Get contours from image data
 * @param imageData - RGBA image data
 * @param width - Image width
 * @param height - Image height
 * @param opacityThreshold - Threshold for determining transparent pixels
 * @returns Array of contour points
 */
export function getContours(
  imageData: Uint8Array,
  width: number,
  height: number,
  opacityThreshold: number = 100
): Point[] {
  console.log('[Contour] Starting getContours. Opacity Threshold:', opacityThreshold);
  const bounds = detectActualImageBounds(imageData, width, height, opacityThreshold);
  if (!bounds.hasContent) {
    console.log('[Contour] No content found based on opacity threshold.');
    return [];
  }
  console.log('[Contour] Detected bounds:', bounds);

  const contourPoints: Point[] = [];
  const isInside = (x: number, y: number): boolean => {
    if (x >= bounds.minX && y >= bounds.minY && x <= bounds.maxX && y <= bounds.maxY) {
      const idx = (y * width + x) * 4;
      return imageData[idx + 3] > opacityThreshold;
    }
    // Consider points outside strict bounds as 'outside' for boundary detection,
    // but ensure x,y are within image dimensions for direct imageData access.
    if (x >= 0 && y >= 0 && x < width && y < height) {
        const idx = (y * width + x) * 4;
        return imageData[idx + 3] > opacityThreshold;
    }
    return false;
  };

  let startX = -1;
  let startY = -1;
  // Find first non-transparent pixel starting from detected bounds
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (isInside(x, y)) { // Check using isInside which respects opacityThreshold
        startX = x;
        startY = y;
        break;
      }
    }
    if (startX !== -1) break;
  }

  if (startX === -1) {
    console.log('[Contour] No starting pixel found within detected bounds.');
    return [];
  }
  console.log(`[Contour] Starting contour trace at: (${startX}, ${startY})`);

  let currentX = startX;
  let currentY = startY;
  contourPoints.push({ x: currentX, y: currentY });

  // Moore's Algorithm specific variables
  // Order: E, SE, S, SW, W, NW, N, NE (clockwise)
  const mooreDx = [1, 1, 0, -1, -1, -1, 0, 1]; 
  const mooreDy = [0, 1, 1, 1, 0, -1, -1, -1]; 

  // bX, bY represent the pixel from which currentX, currentY was entered.
  // For the start, assume we entered from a pixel to the West (background).
  let bX = startX - 1; 
  let bY = startY;

  let iterations = 0;
  const MAX_ITERATIONS_CONTOUR = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1) * 4; // Increased safety factor

  if (contourPoints.length > 0) { // Only proceed if starting point is valid
    do {
      iterations++;
      let foundNext = false;

      // Find the index of (bX,bY) relative to (currentX, currentY) in mooreDx/Dy neighborhood
      // This is the direction from currentX,currentY *to* bX,bY.
      let entryDirIndex = 0; // Default if bX,bY is not a direct neighbor (e.g. first step out of bounds)
      for (let k = 0; k < 8; k++) {
          if (currentX + mooreDx[k] === bX && currentY + mooreDy[k] === bY) {
              entryDirIndex = k;
              break;
          }
      }
      // If bX,bY was, for instance, (startX-1, startY) and current is (startX, startY),
      // then mooreDx[k] = -1, mooreDy[k] = 0. This corresponds to West (index 4).

      // Start scanning clockwise from the neighbor *after* bX,bY.
      for (let i = 0; i < 8; i++) {
        const checkDirIndex = (entryDirIndex + 1 + i) % 8; 
        const nextX = currentX + mooreDx[checkDirIndex];
        const nextY = currentY + mooreDy[checkDirIndex];

        if (isInside(nextX, nextY)) { // Found next boundary pixel
          // Update bX, bY for the *next* iteration: it's the pixel from which (nextX,nextY) was entered.
          // This is the current (currentX, currentY) before the update.
          bX = currentX;
          bY = currentY;

          currentX = nextX;
          currentY = nextY;
          contourPoints.push({ x: currentX, y: currentY });
          foundNext = true;
          break; // Found next point, break from inner for-loop
        }
      }

      if (!foundNext) {
          console.warn('[Contour] Moore trace stuck. No next boundary pixel found after trying all 8 directions.');
          break; // Cannot find next point
      }
      if (iterations >= MAX_ITERATIONS_CONTOUR) {
          console.warn('[Contour] Max iterations reached in Moore trace.');
          break;
      }
    // Stop if we're back at the start point AND we've added more than just the start point.
    } while ((currentX !== startX || currentY !== startY || contourPoints.length <= 1) && iterations < MAX_ITERATIONS_CONTOUR);
  }
  
  if (iterations >= MAX_ITERATIONS_CONTOUR && (currentX !== startX || currentY !== startY)) {
    console.warn('[Contour] Max iterations reached AND contour did not close properly.');
  }
  console.log(`[Contour] Found ${contourPoints.length} points.`);
  if (contourPoints.length > 2) { // RDP needs at least 2 points, but practically more for a line
    const simplifiedPoints = rdp(contourPoints, 1.5); // Epsilon = 1.5, can be adjusted
    console.log(`[Contour] Simplified to ${simplifiedPoints.length} points using RDP.`);
    return simplifiedPoints;
  }
  return contourPoints;
}

/**
 * Ramer-Douglas-Peucker algorithm for path simplification
 * @param points - Array of points {x, y}
 * @param epsilon - Distance threshold
 * @returns Simplified array of points
 */
function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) {
    return points; // Cannot simplify less than 3 points
  }

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  let results: Point[] = [];

  if (dmax > epsilon) {
    const recResults1 = rdp(points.slice(0, index + 1), epsilon);
    const recResults2 = rdp(points.slice(index, points.length), epsilon);
    results = recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    results = [points[0], points[end]];
  }
  return results;
}

/**
 * Calculates the perpendicular distance from a point to a line segment.
 * @param point - The point {x, y}
 * @param lineStart - Start point of the line segment {x, y}
 * @param lineEnd - End point of the line segment {x, y}
 * @returns The perpendicular distance
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) { // lineStart and lineEnd are the same point
    return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);

  let closestX, closestY;
  if (t < 0) {
    closestX = lineStart.x;
    closestY = lineStart.y;
  } else if (t > 1) {
    closestX = lineEnd.x;
    closestY = lineEnd.y;
  } else {
    closestX = lineStart.x + t * dx;
    closestY = lineStart.y + t * dy;
  }

  return Math.sqrt(Math.pow(point.x - closestX, 2) + Math.pow(point.y - closestY, 2));
}

/**
 * Generate Figma vector path from contour points
 * @param points - Array of contour points
 * @returns Figma path data string
 */
export function pointsToFigmaPath(points: Point[]): string {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  
  // Close the path if the first and last points are close enough
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const distance = Math.sqrt(
    Math.pow(lastPoint.x - firstPoint.x, 2) + 
    Math.pow(lastPoint.y - firstPoint.y, 2)
  );
  
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
export function createContourStroke(
  imageData: Uint8Array,
  width: number,
  height: number,
  opacityThreshold: number
): { points: Point[], pathData: string } {
  const points = getContours(imageData, width, height, opacityThreshold);
  const pathData = pointsToFigmaPath(points);
  
  return { points, pathData };
} 