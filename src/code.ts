// Image Stroke Plugin - Add vector strokes to bitmap images

import { StrokeAlgorithm, StrokeParams, createStroke, Bounds } from '../algorithms';

// Initialize plugin
figma.showUI(__html__, { 
  width: 400, 
  themeColors: true,
  height: 480
});

// Define message types
interface BaseMessage {
  type: string;
}

interface CreateStrokeMessage extends BaseMessage {
  type: 'create-stroke';
  strokeWidth: number;
  strokeColor: { r: number; g: number; b: number };
  algorithm: StrokeAlgorithm;
}

interface DecodeImageMessage extends BaseMessage {
  type: 'decode-image';
  bytes: Uint8Array;
}

interface DecodedImageMessage extends BaseMessage {
  type: 'decoded-image';
  width: number;
  height: number;
  data: number[];
}

interface ProcessCanvasMessage extends BaseMessage {
  type: 'process-canvas';
  width: number;
  height: number;
  strokeWidth: number;
  strokeColor: [number, number, number, number];
  imageBytes: Uint8Array;
}

interface ProcessedCanvasMessage extends BaseMessage {
  type: 'processed-canvas';
  bytes: Uint8Array;
}

interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

interface ConvertImageDataMessage extends BaseMessage {
  type: 'convert-image-data';
  imageData: number[];
  width: number;
  height: number;
}

interface ProcessedVectorMessage extends BaseMessage {
  type: 'processed-vector';
  vectorData: {
    pathData: string;
  };
}

// Define plugin message type
type PluginMessage = 
  | CreateStrokeMessage 
  | DecodeImageMessage 
  | DecodedImageMessage 
  | ProcessCanvasMessage
  | ProcessedCanvasMessage
  | ErrorMessage 
  | ConvertImageDataMessage
  | ProcessedVectorMessage;

// Initialize plugin
async function initializePlugin() {
  await figma.loadAllPagesAsync();
  
  // Initialize theme
  const background = figma.currentPage.backgrounds[0] as SolidPaint;
  figma.ui.postMessage({ type: 'theme-update', theme: background.color.r === 1 ? 'light' : 'dark' });
}

// Start initialization
initializePlugin();

// 更新 VectorData 的定义
interface VectorData {
  pathData: string;
  bounds?: Bounds; // 原始图像坐标系中的边界
}

// Create vector path from stroke data
async function createVectorPath(
  pathData: string,
  strokeWidth: number, // 这是用户在 UI 中输入的描边粗细
  strokeColor: { r: number; g: number; b: number },
  imageNode: SceneNode, // 这是用户选择的包含图像的节点 (RECTANGLE/FRAME)
  contentBoundsInOriginalImage: Bounds | undefined, // 原始图像中内容的边界 {minX, minY, maxX, maxY}
  originalImageWidth: number, // 原始图像的宽度
  originalImageHeight: number // 原始图像的高度
): Promise<VectorNode | null> { // Return null on failure

  if (!contentBoundsInOriginalImage) {
    figma.notify("Error: Content bounds are missing, cannot accurately create vector stroke.");
    console.error("createVectorPath: contentBoundsInOriginalImage is undefined.");
    return null;
  }

  if (originalImageWidth <= 0 || originalImageHeight <= 0) {
    figma.notify("Error: Original image dimensions are invalid.");
    console.error(`createVectorPath: Invalid originalImageWidth (${originalImageWidth}) or originalImageHeight (${originalImageHeight}).`);
    return null;
  }

  const vectorNode = figma.createVector();

  vectorNode.vectorPaths = [{
    windingRule: 'NONZERO',
    data: pathData
  }];

  // After setting vectorPaths, vectorNode.x, y, width, height are automatically
  // set to the extents of the pathData. Assuming pathData's coordinates
  // are absolute to the original image, these will match contentBoundsInOriginalImage.
  // For safety and clarity, let's use contentBoundsInOriginalImage directly for calculations.

  const contentOriginalX = contentBoundsInOriginalImage.minX;
  const contentOriginalY = contentBoundsInOriginalImage.minY;
  const contentOriginalWidth = contentBoundsInOriginalImage.maxX - contentBoundsInOriginalImage.minX;
  const contentOriginalHeight = contentBoundsInOriginalImage.maxY - contentBoundsInOriginalImage.minY;

  if (contentOriginalWidth <= 0 || contentOriginalHeight <= 0) {
    // This can happen if bounds detection yields an empty or invalid area.
    figma.notify("Warning: Detected content bounds are empty or invalid. Stroke might not be accurate.");
    console.warn("createVectorPath: Calculated contentOriginalWidth or contentOriginalHeight is zero or negative.");
     // Attempt to proceed but it might look weird, or could return null earlier.
  }

  const scaleX = imageNode.width / originalImageWidth;
  const scaleY = imageNode.height / originalImageHeight;

  // Position the vectorNode: Its top-left should align with the scaled content's top-left.
  vectorNode.x = imageNode.x + contentOriginalX * scaleX;
  vectorNode.y = imageNode.y + contentOriginalY * scaleY;

  // Resize the vectorNode (this scales the path data within it)
  const targetPathWidth = contentOriginalWidth * scaleX;
  const targetPathHeight = contentOriginalHeight * scaleY;
  
  // Ensure target dimensions are not negative, which can happen with extreme scales or bad bounds.
  if (targetPathWidth <= 0 || targetPathHeight <= 0) {
      console.warn(`createVectorPath: Calculated targetPathWidth (${targetPathWidth}) or targetPathHeight (${targetPathHeight}) is zero or negative. Aborting vector creation to prevent Figma errors.`);
      // Clean up the partially created node if it was already added, though it's not at this point.
      // vectorNode.remove(); // Not strictly necessary if not added to scene yet, but good for cleanup if we change order.
      figma.notify("Error: Stroke dimensions would be invalid. Cannot create stroke.");
      return null;
  }
  vectorNode.resize(targetPathWidth, targetPathHeight);

  // Apply Rotation
  if ('rotation' in imageNode && imageNode.rotation !== undefined) {
    vectorNode.rotation = imageNode.rotation;
  }

  // Set stroke properties AFTER transformations
  vectorNode.strokeWeight = strokeWidth;
  vectorNode.strokeAlign = "CENTER";
  vectorNode.strokeCap = "ROUND";
  vectorNode.strokeJoin = "ROUND";
  vectorNode.strokes = [{
    type: 'SOLID',
    color: strokeColor
  }];
  vectorNode.fills = []; // No fill for a stroke path

  if (imageNode.parent && 'appendChild' in imageNode.parent) {
    imageNode.parent.appendChild(vectorNode);
  } else {
    figma.currentPage.appendChild(vectorNode);
    console.warn('Image node parent was not suitable, appended vector to currentPage.');
  }

  return vectorNode;
}

// Create raster image from stroke data
async function createRasterImage(
  resultImageData: Uint8Array,
  width: number,
  height: number,
  node: SceneNode
): Promise<SceneNode> {
  try {
    // 将图像数据先转换为 UI 可以处理的格式
    // 创建一个消息发送到 UI 进行处理
    const processedData = await new Promise<ProcessedCanvasMessage>((resolve, reject) => {
      const originalHandler = figma.ui.onmessage;
      
      const tempHandler = (responseMsg: PluginMessage) => {
        if (responseMsg.type === 'error') {
          figma.ui.onmessage = originalHandler;
          reject(new Error((responseMsg as ErrorMessage).message));
        } else if (responseMsg.type === 'processed-canvas') {
          figma.ui.onmessage = originalHandler;
          resolve(responseMsg as ProcessedCanvasMessage);
        }
      };
      
      figma.ui.onmessage = tempHandler;
      
      // 创建临时画布处理消息
      figma.ui.postMessage({
        type: 'convert-image-data',
        imageData: Array.from(resultImageData),
        width,
        height
      });
    });
    
    // 使用 Figma API 创建图像
    const image = figma.createImage(processedData.bytes);
    
    // 创建一个矩形来容纳图像
    const rect = figma.createRectangle();
    rect.resize(width, height);
    
    // 设置图像为填充
    rect.fills = [{
      type: 'IMAGE',
      scaleMode: 'FILL',
      imageHash: image.hash
    }];
    
    // 定位矩形
    if (node.parent && 'appendChild' in node.parent) {
      const nodeX = ('x' in node) ? node.x : 0;
      const nodeY = ('y' in node) ? node.y : 0;
      
      rect.x = nodeX;
      rect.y = nodeY;
      
      // 设置旋转（如果适用）
      if ('rotation' in node) {
        rect.rotation = node.rotation;
      }
      
      node.parent.appendChild(rect);
    }
    
    return rect;
  } catch (error) {
    console.error('Error creating raster image:', error);
    throw error;
  }
}

// Main message handler
figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'create-stroke') {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.notify('Please select an image');
      return;
    }

    // Show processing status
    figma.ui.postMessage({ type: 'show-status' });

    const node = selection[0];
    if (node.type !== 'RECTANGLE' && node.type !== 'FRAME') {
      figma.notify('Please select a rectangle or frame containing an image');
      return;
    }

    try {
      // Get image fill from node
      const fills = 'fills' in node ? node.fills as Paint[] : [];
      if (!Array.isArray(fills) || fills.length === 0) {
        figma.notify('Selected object must contain an image fill');
        return;
      }

      // Find image fill
      // To get the topmost image fill, we reverse the array before finding.
      // Also ensure the fill is visible.
      const imageFill = [...fills].reverse().find(fill => fill.type === 'IMAGE' && fill.visible !== false);
      if (!imageFill || imageFill.type !== 'IMAGE' || !imageFill.imageHash) {
        figma.notify('Please select an object with a visible image fill');
        // Hide processing status
        figma.ui.postMessage({ type: 'hide-status' });
        return;
      }

      // Get image data
      const image = await figma.getImageByHash(imageFill.imageHash);
      if (!image) {
        figma.notify('Cannot get image data');
        return;
      }

      // Get image bytes
      const bytes = await image.getBytesAsync();
      
      // Decode image data
      const decodedData = await new Promise<DecodedImageMessage>((resolve, reject) => {
        const originalHandler = figma.ui.onmessage;
        
        const tempHandler = (responseMsg: PluginMessage) => {
          if (responseMsg.type === 'error') {
            figma.ui.onmessage = originalHandler;
            reject(new Error((responseMsg as ErrorMessage).message));
          } else if (responseMsg.type === 'decoded-image') {
            figma.ui.onmessage = originalHandler;
            resolve(responseMsg as DecodedImageMessage);
          }
        };
        
        figma.ui.onmessage = tempHandler;
        figma.ui.postMessage({
          type: 'decode-image',
          bytes
        });
      });

      // Convert decoded data to Uint8Array
      const imageDataArray = new Uint8Array(decodedData.data);
      
      // Create stroke params
      const strokeParams: StrokeParams = {
        strokeWidth: msg.strokeWidth,
        strokeColor: msg.strokeColor,
      };
      
      // Create stroke using selected algorithm
      const strokeResult = createStroke(
        msg.algorithm,
            imageDataArray,
            decodedData.width, // originalImageWidth
            decodedData.height, // originalImageHeight
        strokeParams
      );
      
      // Apply result based on type
      if (strokeResult.type === 'vector') {
        const vectorData = strokeResult.data as VectorData;
        if (!vectorData.pathData) {
          figma.notify('Failed to generate vector path');
          // Hide processing status earlier if path generation itself fails
          figma.ui.postMessage({ type: 'hide-status' });
          return;
        }
        
        const createdVectorNode = await createVectorPath(
          vectorData.pathData,
          msg.strokeWidth, // User-defined stroke width from UI
          msg.strokeColor,
          node, // This is the imageNode (the selected Figma layer)
          vectorData.bounds, // Bounds of content in original image coordinates
          decodedData.width, // originalImageWidth
          decodedData.height // originalImageHeight
        );

        if (createdVectorNode) {
          figma.notify('Vector stroke created successfully!');
        } else {
          // Notification of failure already handled in createVectorPath or if pathData was missing
          // figma.notify('Failed to create vector stroke node.'); // This might be redundant
        }
        
      } else if (strokeResult.type === 'raster') {
        const rasterData = strokeResult.data as Uint8Array;
        
        await createRasterImage(
          rasterData,
          decodedData.width,
          decodedData.height,
          node
        );
        
        figma.notify('Raster stroke created successfully!');
        
      }

    } catch (error: unknown) {
      console.error('Error details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      figma.notify(`Error creating stroke: ${errorMessage}`);
    } finally {
      // Hide processing status
      figma.ui.postMessage({ type: 'hide-status' });
    }
  }
};
