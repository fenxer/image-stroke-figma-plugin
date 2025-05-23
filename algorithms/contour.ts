/**
 * Contour method for image stroke using marching squares algorithm
 */

interface Point {
  x: number;
  y: number;
}

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

// Get contours from image data using Moore's Algorithm
export function getContours(
  imageData: Uint8Array,
  width: number,
  height: number,
  opacityThreshold: number = 100
): Point[] {
  const bounds = detectActualImageBounds(imageData, width, height, opacityThreshold);
  if (!bounds.hasContent) {
    return [];
  }

  const contourPoints: Point[] = [];
  const isInside = (x: number, y: number): boolean => {
    if (x >= bounds.minX && y >= bounds.minY && x <= bounds.maxX && y <= bounds.maxY) {
      const idx = (y * width + x) * 4;
      return imageData[idx + 3] > opacityThreshold;
    }
    if (x >= 0 && y >= 0 && x < width && y < height) {
        const idx = (y * width + x) * 4;
        return imageData[idx + 3] > opacityThreshold;
    }
    return false;
  };

  let startX = -1;
  let startY = -1;
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (isInside(x, y)) {
        startX = x;
        startY = y;
        break;
      }
    }
    if (startX !== -1) break;
  }

  if (startX === -1) {
    return [];
  }

  let currentX = startX;
  let currentY = startY;
  contourPoints.push({ x: currentX, y: currentY });

  // Moore's Algorithm: E, SE, S, SW, W, NW, N, NE (clockwise)
  const mooreDx = [1, 1, 0, -1, -1, -1, 0, 1]; 
  const mooreDy = [0, 1, 1, 1, 0, -1, -1, -1]; 

  let bX = startX - 1; 
  let bY = startY;

  let iterations = 0;
  const MAX_ITERATIONS_CONTOUR = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1) * 4;

  if (contourPoints.length > 0) {
    do {
      iterations++;
      let foundNext = false;

      let entryDirIndex = 0;
      for (let k = 0; k < 8; k++) {
          if (currentX + mooreDx[k] === bX && currentY + mooreDy[k] === bY) {
              entryDirIndex = k;
              break;
          }
      }

      for (let i = 0; i < 8; i++) {
        const checkDirIndex = (entryDirIndex + 1 + i) % 8; 
        const nextX = currentX + mooreDx[checkDirIndex];
        const nextY = currentY + mooreDy[checkDirIndex];

        if (isInside(nextX, nextY)) {
          bX = currentX;
          bY = currentY;

          currentX = nextX;
          currentY = nextY;
          contourPoints.push({ x: currentX, y: currentY });
          foundNext = true;
          break;
        }
      }

      if (!foundNext || iterations >= MAX_ITERATIONS_CONTOUR) {
          break;
      }
    } while ((currentX !== startX || currentY !== startY || contourPoints.length <= 1) && iterations < MAX_ITERATIONS_CONTOUR);
  }
  
  if (contourPoints.length > 2) {
    const simplifiedPoints = rdp(contourPoints, 1.5);
    return simplifiedPoints;
  }
  return contourPoints;
}

// Ramer-Douglas-Peucker algorithm for path simplification
function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) {
    return points;
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

// Calculate perpendicular distance from point to line segment
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
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

// Generate Figma vector path from contour points
export function pointsToFigmaPath(points: Point[]): string {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  
  // Close path if endpoints are close or path is complex
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

// Create stroke using contour method
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