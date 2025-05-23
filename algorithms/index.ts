/**
 * Factory and type definitions for stroke algorithms
 */
import { createContourStroke } from './contour';
import { createDistanceStrokePath, detectImageBounds, pointsToPath, toBinaryImage, traceAllContoursFromBinaryImage, rdp } from './distance';

console.log('DEV_DEBUG: createDistanceStrokePath is', createDistanceStrokePath);

// Define stroke algorithm types
export type StrokeAlgorithm = 'contour' | 'distance';

// Define stroke parameter interface
export interface StrokeParams {
  strokeWidth: number;
  strokeColor: {
    r: number;
    g: number;
    b: number;
  };
  // alphaThreshold?: number; // Removed from public params
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Vector data type
export interface VectorData {
  pathData: string;
  bounds?: Bounds;
}

// Raster data type
export type RasterData = Uint8Array;

// Define stroke result interface
export interface StrokeResult {
  type: 'vector' | 'raster';
  data: VectorData | RasterData;
}

/**
 * Create stroke for an image using the specified algorithm
 * @param algorithm - Stroke algorithm to use
 * @param imageData - RGBA image data
 * @param width - Image width
 * @param height - Image height
 * @param params - Stroke parameters
 * @returns Stroke result
 */
export function createStroke(
  algorithm: StrokeAlgorithm,
  imageData: Uint8Array,
  width: number,
  height: number,
  params: StrokeParams
): StrokeResult {
  const { strokeWidth } = params;
  // const alphaThreshold = params.alphaThreshold || 127; // Removed
  const internalAlphaThreshold = 10; // Fixed internal threshold (0-255)
  
  // const rgbaColor: [number, number, number, number] = [ // No longer needed here if 'canvas' type is removed
  //   Math.round(strokeColor.r * 255),
  //   Math.round(strokeColor.g * 255),
  //   Math.round(strokeColor.b * 255),
  //   255 // Full opacity
  // ];
  
  // const bounds = detectImageBounds(imageData, width, height, internalAlphaThreshold); // Commented out as it's only used by contour and distance which might do their own specific bounding if needed differently
  
  let result: StrokeResult;
  
  switch (algorithm) {
    case 'contour': {
      const contourResult = createContourStroke(
        imageData,
        width,
        height,
        internalAlphaThreshold // Use fixed internal threshold
      );
      const generalBounds = detectImageBounds(imageData, width, height, internalAlphaThreshold);
      result = {
        type: 'vector',
        data: { 
          pathData: contourResult.pathData,
          bounds: generalBounds 
        }
      };
      break;
    }
      
    case 'distance': {
      const distanceStrokeData = createDistanceStrokePath(
        imageData,
        width,
        height,
        strokeWidth,
        internalAlphaThreshold // Use fixed internal threshold
      );
      
      if (distanceStrokeData.pathData) {
        result = {
          type: 'vector',
          data: {
            pathData: distanceStrokeData.pathData,
            bounds: distanceStrokeData.bounds
          }
        };
      } else {
        throw new Error('Failed to generate vector path for distance transform');
      }
      break;
    }

    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
  
  return result;
}

export { detectImageBounds, pointsToPath, toBinaryImage, traceAllContoursFromBinaryImage, rdp }; 