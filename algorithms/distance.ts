/**
 * Distance transform method for image stroke using Meijster's algorithm
 */

// Compute Euclidean distance transform for binary image
export function computeDistances(
  binaryImage: Uint8Array,
  width: number,
  height: number
): number[] {
  const infinity = width + height;
  const b = binaryImage;
  const g = new Array(width * height);
  
  for (let x = 0; x < width; x++) {
    if (b[x]) {
      g[x] = 0;
    } else {
      g[x] = infinity;
    }
    
    // Scan 1 - top to bottom
    for (let y = 1; y < height; y++) {
      if (b[x + y * width]) {
        g[x + y * width] = 0;
      } else {
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

  function EDTFunc(x: number, i: number, gi: number): number {
    return (x - i) * (x - i) + gi * gi;
  }
  
  function EDTSep(i: number, u: number, gi: number, gu: number): number {
    return Math.floor((u * u - i * i + gu * gu - gi * gi) / (2 * (u - i)));
  }

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
      } else {
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


// Convert RGBA image data to binary image based on alpha threshold
export function toBinaryImage(
  imageData: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number = 5
): Uint8Array {
  const binaryImage = new Uint8Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      binaryImage[y * width + x] = imageData[idx + 3] < alphaThreshold ? 0 : 1;
    }
  }
  
  return binaryImage;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Detect image bounds (bounding box of non-transparent areas)
export function detectImageBounds(
  imageData: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number = 5
): Bounds {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (imageData[idx + 3] >= alphaThreshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hasContent = true;
      }
    }
  }

  if (!hasContent) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return { minX, minY, maxX, maxY };
}

// Ramer-Douglas-Peucker algorithm for path simplification
interface Point { x: number; y: number; }

export function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 2) {
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

  let results: Point[];

  if (dmax > epsilon) {
    const recResults1 = rdp(points.slice(0, index + 1), epsilon);
    const recResults2 = rdp(points.slice(index, end + 1), epsilon);
    results = recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    results = [points[0], points[end]];
  }
  return results;
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  let dx = lineEnd.x - lineStart.x;
  let dy = lineEnd.y - lineStart.y;

  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag > 0) {
    dx /= mag;
    dy /= mag;
  }

  const pvx = point.x - lineStart.x;
  const pvy = point.y - lineStart.y;

  const pvDot = dx * pvx + dy * pvy;

  const ax = pvx - pvDot * dx;
  const ay = pvy - pvDot * dy;

  return Math.sqrt(ax * ax + ay * ay);
}

/**
 * Convert points to SVG path string
 */
export function pointsToPath(points: {x: number, y: number}[]): string {
  if (points.length === 0) return '';
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  
  path += ' Z';
  
  return path;
}

// Trace contours from binary image using Moore's neighbor tracing
export function traceAllContoursFromBinaryImage(
  binaryImage: Uint8Array,
  width: number,
  height: number
): Point[][] {
  const allContours: Point[][] = [];
  const visitedImage = new Uint8Array(binaryImage);

  for (let yScan = 0; yScan < height; yScan++) {
    for (let xScan = 0; xScan < width; xScan++) {
      if (visitedImage[yScan * width + xScan] === 1) {
        const currentContour: Point[] = [];
        const startX = xScan;
        const startY = yScan;
        
        let currentX = startX;
        let currentY = startY;
        visitedImage[currentY * width + currentX] = 2;
        currentContour.push({ x: currentX, y: currentY });

        const mooreDx = [1, 1, 0, -1, -1, -1, 0, 1]; 
        const mooreDy = [0, 1, 1, 1, 0, -1, -1, -1]; 
        let bX = startX - 1; 
        let bY = startY;
        
        let iterations = 0;
        const MAX_ITERATIONS_PER_CONTOUR = width * height * 2;

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

            if (nextX === startX && nextY === startY && currentContour.length >= 2) {
              bX = currentX;
              bY = currentY;
              currentX = nextX;
              currentY = nextY;
              foundNext = true;
              break; 
            }

            if (nextX >= 0 && nextY >= 0 && nextX < width && nextY < height) {
              if (visitedImage[nextY * width + nextX] === 1) {
                bX = currentX;
                bY = currentY;
                currentX = nextX;
                currentY = nextY;
                visitedImage[currentY * width + currentX] = 2;
                currentContour.push({ x: currentX, y: currentY });
                foundNext = true;
                break; 
              }
            }
          }

          if (!foundNext || iterations >= MAX_ITERATIONS_PER_CONTOUR) {
              break; 
          }
        } while (currentX !== startX || currentY !== startY); 
        
        if (currentContour.length > 0) {
            allContours.push(currentContour);
        }
      }
    }
  }
  return allContours;
}

// Create vector stroke path using distance transform
export function createDistanceStrokePath(
  imageData: Uint8Array,
  width: number,
  height: number,
  strokeWidth: number,
  alphaThreshold: number
): { pathData: string, bounds: Bounds } {
  const overallBounds = detectImageBounds(imageData, width, height, alphaThreshold);
  const binaryImage = toBinaryImage(imageData, width, height, alphaThreshold);
  const distances = computeDistances(binaryImage, width, height);

  const silhouetteBinaryImage = new Uint8Array(width * height);
  for (let i = 0; i < distances.length; i++) {
    if (distances[i] === 1) {
      silhouetteBinaryImage[i] = 1;
    } else {
      silhouetteBinaryImage[i] = 0;
    }
  }
  
  const allFoundContours = traceAllContoursFromBinaryImage(silhouetteBinaryImage, width, height);
  
  if (allFoundContours.length === 0) {
    return { pathData: '', bounds: overallBounds };
  }

  let combinedPathData = '';
  const epsilon = 1;
  const MIN_POINTS_FOR_CONTOUR = 10; 

  for (let i = 0; i < allFoundContours.length; i++) {
    const contourPoints = allFoundContours[i];

    if (contourPoints.length < MIN_POINTS_FOR_CONTOUR) { 
        continue; 
    }

    const simplifiedPoints = rdp(contourPoints, epsilon);
    
    if (simplifiedPoints.length >= 2) { 
      combinedPathData += pointsToPath(simplifiedPoints) + ' '; 
    }
  }
  
  if (combinedPathData.trim() === '') {
    return { pathData: '', bounds: overallBounds };
  }
  
  return { pathData: combinedPathData.trim(), bounds: overallBounds };
}

// Create stroke using distance transform method
export function createDistanceStroke(
  imageData: Uint8Array,
  width: number,
  height: number,
  strokeWidth: number,
  strokeColor: [number, number, number, number],
  alphaThreshold: number
): Uint8Array {
  const resultData = new Uint8Array(imageData);
  const binaryImage = toBinaryImage(imageData, width, height, alphaThreshold);
  const distances = computeDistances(binaryImage, width, height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const distance = distances[y * width + x];
      
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