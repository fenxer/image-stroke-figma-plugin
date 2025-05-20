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
export function computeDistances(
  binaryImage: Uint8Array,
  width: number,
  height: number
): number[] {
  // First phase
  const infinity = width + height;
  const b = binaryImage;
  const g = new Array(width * height);
  
  for (let x = 0; x < width; x++) {
    // Base cases
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

  // Helper functions for Euclidean distance
  function EDTFunc(x: number, i: number, gi: number): number {
    return (x - i) * (x - i) + gi * gi;
  }
  
  function EDTSep(i: number, u: number, gi: number, gu: number): number {
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

/**
 * Convert RGBA image data to binary image based on alpha threshold
 * @param imageData - RGBA image data
 * @param width - Image width
 * @param height - Image height
 * @param alphaThreshold - Threshold for determining transparency
 * @returns Binary image array (1 for non-transparent, 0 for transparent)
 */
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

// 新增：检测图像边界点并提取边界信息
interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 检测图像的边界（非透明区域的边界框）
 * @param imageData - RGBA图像数据
 * @param width - 图像宽度
 * @param height - 图像高度
 * @param alphaThreshold - 透明度阈值
 * @returns 边界信息
 */
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

  // 如果图像是完全透明的，返回全零边界
  if (!hasContent) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Ramer-Douglas-Peucker algorithm for path simplification
 * @param points - Array of points {x, y}
 * @param epsilon - Distance threshold
 * @returns Simplified array of points
 */
interface Point { x: number; y: number; }

// function rdp(points: Point[], epsilon: number): Point[] { // Temporarily unused -> Restored
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

  // Normalize
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
 * 将点集转换为SVG路径
 * @param points - 点集
 * @returns SVG路径字符串
 */
export function pointsToPath(points: {x: number, y: number}[]): string {
  if (points.length === 0) return '';
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  
  // 闭合路径
  path += ' Z';
  
  return path;
}

// Adapted Moore's Neighbor Tracing (from contour.ts) to trace a given binary image
// function traceAllContoursFromBinaryImage( // Temporarily unused -> Restored
export function traceAllContoursFromBinaryImage(
  binaryImage: Uint8Array, // The image to trace (e.g., silhouette from distance === 1)
  width: number,
  height: number
): Point[][] { // Returns an array of paths (arrays of points)
  const allContours: Point[][] = [];
  const visitedImage = new Uint8Array(binaryImage); // Create a mutable copy to mark visited pixels

  for (let yScan = 0; yScan < height; yScan++) {
    for (let xScan = 0; xScan < width; xScan++) {
      if (visitedImage[yScan * width + xScan] === 1) { // Found a starting point for a new contour
        const currentContour: Point[] = [];
        const startX = xScan;
        const startY = yScan;
        
        //console.log(`[Distance/MultiTrace] Starting new contour trace at: (${startX}, ${startY})`);

        let currentX = startX;
        let currentY = startY;
        visitedImage[currentY * width + currentX] = 2; // Mark as visited for this trace pass (prevents re-picking as start)
        currentContour.push({ x: currentX, y: currentY });

        const mooreDx = [1, 1, 0, -1, -1, -1, 0, 1]; 
        const mooreDy = [0, 1, 1, 1, 0, -1, -1, -1]; 
        let bX = startX - 1; 
        let bY = startY; // Initialize bX, bY (previous pixel) for the first step
        
        let iterations = 0;
        const MAX_ITERATIONS_PER_CONTOUR = width * height * 2; // Increased safety margin

        do {
          iterations++;
          let foundNext = false;
          let entryDirIndex = 0;
          // Determine the direction from which we entered the current pixel (currentX, currentY)
          // by finding which neighbor of currentX, currentY is bX, bY.
          for (let k = 0; k < 8; k++) {
              if (currentX + mooreDx[k] === bX && currentY + mooreDy[k] === bY) {
                  entryDirIndex = k; // This is the direction *towards* bX,bY from currentX,currentY
                  break;
              }
          }
          
          for (let i = 0; i < 8; i++) { // Check all 8 directions, starting clockwise from where we came
            const checkDirIndex = (entryDirIndex + 1 + i) % 8; 
            const nextX = currentX + mooreDx[checkDirIndex];
            const nextY = currentY + mooreDy[checkDirIndex];

            // Condition 1: Try to close the loop
            if (nextX === startX && nextY === startY && currentContour.length >= 2) {
              // This is the original starting pixel, and we have enough points to form a loop.
              bX = currentX; // Update bX, bY before moving
              bY = currentY;
              currentX = nextX; // Move to startX, startY
              currentY = nextY;
              // Do NOT add startX, startY to currentContour again. SVG 'Z' closes it.
              foundNext = true; // This will allow the while loop to terminate correctly.
              break; 
            }

            // Condition 2: Move to a valid, unvisited boundary pixel
            if (nextX >= 0 && nextY >= 0 && nextX < width && nextY < height) {
              if (visitedImage[nextY * width + nextX] === 1) { // Is a '1' (part of silhouette) and not yet part of *any* contour's trace path
                bX = currentX;
                bY = currentY;
                currentX = nextX;
                currentY = nextY;
                visitedImage[currentY * width + currentX] = 2; // Mark as visited (part of the current contour path)
                currentContour.push({ x: currentX, y: currentY });
                foundNext = true;
                break; 
              }
            }
          }

          if (!foundNext) {
              // console.warn('[Distance/MultiTrace] Moore trace stuck on a contour.');
              break; 
          }
          if (iterations >= MAX_ITERATIONS_PER_CONTOUR) {
              console.warn('[Distance/MultiTrace] Max iterations reached for a contour.');
              break;
          }
        // Loop until currentX, currentY is back at startX, startY
        // OR if !foundNext (stuck) OR max iterations reached.
        } while (currentX !== startX || currentY !== startY); 
        
        // Check if the contour actually closed or if the loop broke for other reasons
        if (currentX === startX && currentY === startY && currentContour.length > 0) {
            // Successfully closed.
            // console.log(`[Distance/MultiTrace] Contour closed. Start: (${startX},${startY}), Length: ${currentContour.length}`);
        } else if (currentContour.length > 0) { // Only log if points were collected
             console.log(`[Distance/MultiTrace] Contour (length ${currentContour.length}) did NOT close. Start: (${startX},${startY}), End: (${currentX},${currentY}), Iterations: ${iterations}`);
        }
        
        // Add the traced contour if it has any points (actual filtering by MIN_POINTS_FOR_CONTOUR happens later)
        if (currentContour.length > 0) {
            allContours.push(currentContour);
            // console.log(`[Distance/MultiTrace] Traced a contour with ${currentContour.length} points.`);
        }
      }
    }
  }
  console.log(`[Distance/MultiTrace] Found ${allContours.length} distinct contours.`);
  return allContours;
}

/**
 * 创建基于距离变换的矢量描边路径
 * @param imageData - RGBA图像数据
 * @param width - 图像宽度
 * @param height - 图像高度
 * @param strokeWidth - 描边宽度
 * @param alphaThreshold - 透明度阈值
 * @returns 矢量路径数据和边界信息
 */
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
    // console.log('[Distance] No contours traced from silhouette, returning empty path.');
    return { pathData: '', bounds: overallBounds };
  }

  let combinedPathData = '';
  const epsilon = 1; // Temporarily unused -> Restored

  const MIN_POINTS_FOR_CONTOUR = 10; 

  for (let i = 0; i < allFoundContours.length; i++) {
    const contourPoints = allFoundContours[i]; // Changed to const

    if (contourPoints.length < MIN_POINTS_FOR_CONTOUR) { 
        // console.log(`[Distance] Contour ${i} has less than ${MIN_POINTS_FOR_CONTOUR} points (${contourPoints.length}), skipping.`);
        continue; 
    }

    // Path simplification using RDP - Restored
    const simplifiedPoints = rdp(contourPoints, epsilon);
    // console.log(`[Distance] Contour ${i} original ${contourPoints.length}, simplified to ${simplifiedPoints.length} points using RDP (epsilon: ${epsilon}).`);
    
    if (simplifiedPoints.length >= 2) { 
      combinedPathData += pointsToPath(simplifiedPoints) + ' '; 
    } else {
        // console.log(`[Distance] Contour ${i} after RDP has less than 2 points (${simplifiedPoints.length}), skipping path generation.`);
    }
  }
  
  if (combinedPathData.trim() === '') {
    // console.log('[Distance] No valid path data generated after processing all contours.'); // 你可以按需取消注释
    return { pathData: '', bounds: overallBounds };
  }
  
  return { pathData: combinedPathData.trim(), bounds: overallBounds };
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
export function createDistanceStroke(
  imageData: Uint8Array,
  width: number,
  height: number,
  strokeWidth: number,
  strokeColor: [number, number, number, number],
  alphaThreshold: number
): Uint8Array {
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