/**
 * Factory and type definitions for stroke algorithms
 */
import { createContourStroke } from './contour';
import { createDistanceStrokePath, detectImageBounds, pointsToPath, toBinaryImage, traceAllContoursFromBinaryImage, rdp } from './distance';
// import { createRotateStroke } from './rotate'; // Not directly used in this file

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

// 边界接口定义
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
  
  // 计算图像边界，用于确保矢量路径和边缘对齐
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
      // Use the bounds detected by detectImageBounds for general positioning,
      // the contour itself is already in image coordinates.
      const generalBounds = detectImageBounds(imageData, width, height, internalAlphaThreshold);
      result = {
        type: 'vector',
        data: { 
          pathData: contourResult.pathData,
          bounds: generalBounds // Use generalBounds for overall positioning by src/code.ts
        }
      };
      break;
    }
      
    case 'distance': {
      // 对于距离变换算法，我们通过绘制边界路径来创建矢量路径
      // 而不是生成图像数据
      const distanceStrokeData = createDistanceStrokePath(
        imageData,
        width,
        height,
        strokeWidth,
        internalAlphaThreshold // Use fixed internal threshold
      );
      
      // 确保有路径数据
      if (distanceStrokeData.pathData) {
        result = {
          type: 'vector',
          data: {
            pathData: distanceStrokeData.pathData,
            bounds: distanceStrokeData.bounds
          }
        };
      } else {
        // 如果没有生成路径，返回错误
        throw new Error('Failed to generate vector path for distance transform');
      }
      break;
    }
      
    /* case 'rotate': { // Removed rotate case
      // 对于旋转算法，我们将引导UI创建一个简化的路径
      result = {
        type: 'canvas',
        data: {
          width,
          height,
          strokeWidth,
          strokeColor: rgbaColor,
          bounds: bounds
        }
      };
      break;
    } */
      
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
  
  return result;
}

// 导出边界检测函数，让其他文件也可以使用
export { detectImageBounds, pointsToPath, toBinaryImage, traceAllContoursFromBinaryImage, rdp }; 