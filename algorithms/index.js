/**
 * Factory and type definitions for stroke algorithms
 */
import { createContourStroke } from './contour';
import { createDistanceStroke } from './distance';
/**
 * Create stroke for an image using the specified algorithm
 * @param algorithm - Stroke algorithm to use
 * @param imageData - RGBA image data
 * @param width - Image width
 * @param height - Image height
 * @param params - Stroke parameters
 * @returns Stroke result
 */
export function createStroke(algorithm, imageData, width, height, params) {
    const { strokeWidth, strokeColor } = params;
    const alphaThreshold = params.alphaThreshold || 127;
    // Convert RGB color to RGBA array
    const rgbaColor = [
        Math.round(strokeColor.r * 255),
        Math.round(strokeColor.g * 255),
        Math.round(strokeColor.b * 255),
        255 // Full opacity
    ];
    let result;
    switch (algorithm) {
        case 'contour': {
            const contourResult = createContourStroke(imageData, width, height, alphaThreshold);
            result = {
                type: 'vector',
                data: { pathData: contourResult.pathData }
            };
            break;
        }
        case 'distance': {
            const resultImageData = createDistanceStroke(imageData, width, height, strokeWidth, rgbaColor, alphaThreshold);
            result = {
                type: 'raster',
                data: resultImageData
            };
            break;
        }
        case 'rotate': {
            // For rotate algorithm, we'll need to process it in the UI side
            // using canvas operations
            result = {
                type: 'canvas',
                data: {
                    width,
                    height,
                    strokeWidth,
                    strokeColor: rgbaColor
                }
            };
            break;
        }
        default:
            throw new Error(`Unknown algorithm: ${algorithm}`);
    }
    return result;
}
