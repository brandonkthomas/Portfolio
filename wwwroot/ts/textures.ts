/**
 * textures.js
 * @fileoverview Texture generation utilities for starfield and nebulae
 */

import { isMobile, isErrorPage, logEvent, LogData, LogLevel } from './common';

//==============================================================================================
/**
 * Creates a circular texture for stars
 * @description Creates a canvas with a radial gradient for star appearance
 * @returns {THREE.Texture} The created texture
 */
export function createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;

    const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

//==============================================================================================
/**
 * Creates a nebula texture
 * @description Generates a cloudy, nebula-like texture with watercolor effect
 * @param {boolean} isBackground - Whether this is a background nebula (more blurred)
 * @param {number} shapeType - Integer 0-4 determining the shape variation
 * @returns {THREE.Texture} The created texture
 */
export function createNebulaTexture(isBackground: boolean = false, shapeType: number = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    
    // Fill with transparent background
    ctx.clearRect(0, 0, 256, 256);
    
    // Create base shape with random irregularities
    drawIrregularBase(ctx, shapeType);
    
    // Add noise for more texture
    const imageData = ctx.getImageData(0, 0, 256, 256);
    const data = imageData.data;
    
    // Apply perlin-like noise patterns for texture
    applyTextureNoise(data, 256);
    
    ctx.putImageData(imageData, 0, 0);
    
    const supportsFilter = typeof (ctx as any).filter !== 'undefined';
    
    // Apply multiple blur passes for smoother / watercolor-like effect
    const blurPasses = isBackground ? 5 : 3;
    const blurAmount = isBackground 
        ? (supportsFilter ? '12px' : '240px')
        : (supportsFilter ? '8px' : '160px');
    
    if (supportsFilter) {
        for (let i = 0; i < blurPasses; i++) {
            ctx.filter = `blur(${blurAmount})`;
            ctx.drawImage(canvas, 0, 0);
        }
    } else {
        // Safari fallback: approximate blur via downscale/upscale passes
        const tmpCanvas = document.createElement('canvas');

        tmpCanvas.width = canvas.width;
        tmpCanvas.height = canvas.height;

        const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        const scaleFactor = isBackground ? 0.5 : 0.75;
        for (let pass = 0; pass < blurPasses; pass++) {
            // draw downscaled copy
            tmpCtx.clearRect(0, 0, canvas.width, canvas.height);
            tmpCtx.drawImage(
                canvas,
                0,
                0,
                canvas.width,
                canvas.height,
                0,
                0,
                canvas.width * scaleFactor,
                canvas.height * scaleFactor
            );
            // draw back upscaled to canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
                tmpCanvas,
                0,
                0,
                canvas.width * scaleFactor,
                canvas.height * scaleFactor,
                0,
                0,
                canvas.width,
                canvas.height
            );
        }

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = isMobile() ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.globalCompositeOperation = 'source-over';
    }
    
    ctx.filter = 'none';
    
    // Ensure edges fade to transparent with irregular mask
    const finalImageData = ctx.getImageData(0, 0, 256, 256);
    const finalData = finalImageData.data;
    
    // Apply final edge treatment with irregular boundaries
    applyIrregularEdges(finalData, 256);
    
    ctx.putImageData(finalImageData, 0, 0);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

//==============================================================================================
/**
 * Returns a cached nebula texture for the given variant
 * BT 2025-11-11: regenerating canvas textures live was causing huge stutters
 */
const nebulaTextureCache = new Map<string, any>();
export function getNebulaTexture(isBackground: boolean = false, shapeType: number = 0) {
    const key = `${isBackground ? 1 : 0}:${shapeType|0}`;
    let tex = nebulaTextureCache.get(key);
    if (!tex) {
        tex = createNebulaTexture(isBackground, shapeType|0);
        nebulaTextureCache.set(key, tex);
    }
    return tex;
}

//==============================================================================================
/**
 * Draws an irregular base shape for nebulae
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} shapeType - Type of shape to draw (0-4)
 */
function drawIrregularBase(ctx: CanvasRenderingContext2D, shapeType: number) {
    const width = 256;
    const height = 256;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Reduce base alpha for error pages
    const baseAlpha = isErrorPage() ? 0.01 : 0.05;
    const alphaMultiplier = isErrorPage() ? 0.4 : 1.0;
    
    // Different shape bases depending on type
    switch(shapeType) {
        case 0: // Multiple overlapping blobs
            for (let i = 0; i < 3 + Math.random() * 3; i++) {
                const offsetX = (Math.random() - 0.5) * 100;
                const offsetY = (Math.random() - 0.5) * 100;
                const x = centerX + offsetX;
                const y = centerY + offsetY;
                const radius = 20 + Math.random() * 60;
                
                const gradient = ctx.createRadialGradient(
                    x, y, 0, 
                    x, y, radius
                );
                
                const blobAlpha = (baseAlpha + Math.random() * 0.09) * alphaMultiplier;
                gradient.addColorStop(0, `rgba(255, 255, 255, ${blobAlpha})`);
                gradient.addColorStop(0.5, `rgba(255, 255, 255, ${blobAlpha * 0.5})`);
                gradient.addColorStop(0.9, 'rgba(255, 255, 255, 0.01)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
            }
            break;
            
        case 1: // Stretched nebula cloud
            // Draw elongated shape
            ctx.beginPath();
            
            // Create random bezier curve path
            const curvePoints: Array<{x: number; y: number}> = [];
            const numPoints = 5 + Math.floor(Math.random() * 3);
            
            for (let i = 0; i < numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                const radius = 40 + Math.random() * 30; 
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                curvePoints.push({x, y});
            }
            
            // Close the loop
            curvePoints.push(curvePoints[0]);
            
            // Draw the bezier curve
            ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
            for (let i = 1; i < curvePoints.length; i++) {
                const xc = (curvePoints[i-1].x + curvePoints[i].x) / 2;
                const yc = (curvePoints[i-1].y + curvePoints[i].y) / 2;
                ctx.quadraticCurveTo(curvePoints[i-1].x, curvePoints[i-1].y, xc, yc);
            }
            
            // Create gradient for filling
            const stretchedGradient = ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, 80
            );
            
            const stretchAlpha = 0.05 + Math.random() * 0.09;
            stretchedGradient.addColorStop(0, `rgba(255, 255, 255, ${stretchAlpha})`);
            stretchedGradient.addColorStop(0.7, `rgba(255, 255, 255, ${stretchAlpha * 0.3})`);
            stretchedGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = stretchedGradient;
            ctx.fill();
            break;
            
        case 2: // Spiral/swirl pattern
            const spiralPoints: Array<{x: number; y: number; alpha: number}> = [];
            const spiralArms = 1 + Math.floor(Math.random() * 3);
            
            for (let arm = 0; arm < spiralArms; arm++) {
                const armOffset = (arm / spiralArms) * Math.PI * 2;
                
                for (let i = 0; i < 200; i++) {
                    const angle = armOffset + (i / 30) * Math.PI;
                    const spiralRadius = i / 5;
                    const x = centerX + Math.cos(angle) * spiralRadius;
                    const y = centerY + Math.sin(angle) * spiralRadius;
                    
                    if (x >= 0 && x < width && y >= 0 && y < height) {
                        const pointAlpha = 0.07 * (1 - i/200);
                        spiralPoints.push({x, y, alpha: pointAlpha});
                    }
                }
            }
            
            // Draw spiral points with gradients
            for (const point of spiralPoints) {
                const dotRadius = 10 + Math.random() * 5;
                const gradient = ctx.createRadialGradient(
                    point.x, point.y, 0,
                    point.x, point.y, dotRadius
                );
                
                gradient.addColorStop(0, `rgba(255, 255, 255, ${point.alpha})`);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(point.x - dotRadius, point.y - dotRadius, 
                            dotRadius * 2, dotRadius * 2);
            }
            break;
            
        case 3: // Filament-like structure
            const filaments = 2 + Math.floor(Math.random() * 3);
            
            for (let f = 0; f < filaments; f++) {
                // Create curved filament
                ctx.beginPath();
                
                // Start point
                const startX = centerX + (Math.random() - 0.5) * 100;
                const startY = centerY + (Math.random() - 0.5) * 100;
                
                ctx.moveTo(startX, startY);
                
                // Create 2-3 control points for curve
                const cp1x = centerX + (Math.random() - 0.5) * 150;
                const cp1y = centerY + (Math.random() - 0.5) * 150;
                const cp2x = centerX + (Math.random() - 0.5) * 150;
                const cp2y = centerY + (Math.random() - 0.5) * 150;
                const endX = centerX + (Math.random() - 0.5) * 100;
                const endY = centerY + (Math.random() - 0.5) * 100;
                
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
                
                // Create gradient along the path
                const filamentAlpha = 0.05 + Math.random() * 0.09;
                ctx.lineWidth = 5 + Math.random() * 20;
                ctx.strokeStyle = `rgba(255, 255, 255, ${filamentAlpha})`;
                ctx.stroke();
                
                // Add glow around the filament
                ctx.shadowColor = 'white';
                ctx.shadowBlur = 10;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
            break;
            
        case 4: // Chaotic noise clouds
            // Create several overlapping perlin-like noise patterns
            for (let layer = 0; layer < 3; layer++) {
                // Create temporary canvas for this layer
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
                
                // Draw noise pattern
                const imageData = tempCtx.getImageData(0, 0, width, height);
                const data = imageData.data;
                
                // Frequency and amplitude for this layer
                const frequency = 0.01 + layer * 0.01;
                const amplitude = 0.05 + Math.random() * 0.05;
                
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const i = (y * width + x) * 4;
                        
                        // Simple noise function
                        const nx = x * frequency;
                        const ny = y * frequency;
                        const noise = simplexLikeNoise(nx, ny, layer);
                        
                        // Only create pattern where noise is positive
                        if (noise > 0) {
                            const noiseAlpha = noise * amplitude;
                            data[i] = 255;
                            data[i+1] = 255;
                            data[i+2] = 255;
                            data[i+3] = noiseAlpha * 255;
                        }
                    }
                }
                
                tempCtx.putImageData(imageData, 0, 0);
                
                // Blur this layer
                tempCtx.filter = 'blur(15px)';
                tempCtx.drawImage(tempCanvas, 0, 0);
                
                // Draw layer onto main canvas
                ctx.globalAlpha = 0.2 + Math.random() * 0.2;
                ctx.drawImage(tempCanvas, 0, 0);
                ctx.globalAlpha = 1.0;
            }
            break;
            
        default:
            // Fallback to basic cloud
            const defaultGradient = ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, 80
            );
            
            const defaultAlpha = 0.05 + Math.random() * 0.09;
            defaultGradient.addColorStop(0, `rgba(255, 255, 255, ${defaultAlpha})`);
            defaultGradient.addColorStop(0.7, `rgba(255, 255, 255, ${defaultAlpha * 0.3})`);
            defaultGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = defaultGradient;
            ctx.fillRect(0, 0, width, height);
    }
}

//==============================================================================================
/**
 * Applies texture noise to nebula
 * @param {Uint8ClampedArray} data - Image data array
 * @param {number} size - Canvas size
 */
function applyTextureNoise(data: Uint8ClampedArray, size: number) {
    const brightnessMultiplier = isErrorPage() ? 0.3 : 1.0;
    const alphaMultiplier = isErrorPage() ? 0.4 : 1.0;
    
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
            // Add noise to all channels
            const noiseAmount = isErrorPage() ? 0.2 : 0.4;
            const noise = (Math.random() - 0.5) * noiseAmount;
            
            // Alpha noise - keep low but visible values
            (data as any)[i + 3] = Math.max(0, Math.min(140, data[i + 3] * alphaMultiplier + noise * 15));
            
            // Boost RGB channels for better visibility while keeping alpha low
            if (Math.random() > 0.5) {
                const boost = isErrorPage() ? 1.2 : 1.7;
                (data as any)[i] = Math.min(255, data[i] * boost * brightnessMultiplier + noise * 20);
                (data as any)[i + 1] = Math.min(255, data[i + 1] * boost * brightnessMultiplier + noise * 20);
                (data as any)[i + 2] = Math.min(255, data[i + 2] * boost * brightnessMultiplier + noise * 20);
            }
            
            // Apply distortion near edges
            const pixelX = (i / 4) % size;
            const pixelY = Math.floor((i / 4) / size);
            
            // Distance from center (normalized 0-1)
            const dx = (pixelX - size/2) / (size/2);
            const dy = (pixelY - size/2) / (size/2);
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            
            // Create smooth falloff near edges with noise
            if (distFromCenter > 0.7) {
                // Add some noise to the edge
                const edgeNoise = Math.cos(pixelX * 0.1) * Math.sin(pixelY * 0.1) * 0.1;
                
                // Apply falloff with noise
                const edgeFalloff = Math.max(0, 1 - ((distFromCenter - 0.7) / (0.3 + edgeNoise)));
                (data as any)[i + 3] = Math.floor(data[i + 3] * edgeFalloff * edgeFalloff);
            }
        }
    }
}

//==============================================================================================
/**
 * Applies irregular edges to the nebula texture
 * @param {Uint8ClampedArray} data - Image data array
 * @param {number} size - Canvas size
 */
function applyIrregularEdges(finalData: Uint8ClampedArray, size: number) {
    // Generate noise values for the edge irregularity
    const edgeNoise: number[] = [];
    for (let i = 0; i < 360; i++) {
        // Create varying edge distances (0.8-1.0 radius)
        edgeNoise.push(0.8 + (Math.cos(i * 0.1) * Math.sin(i * 0.2) + 1) * 0.1);
    }
    
    for (let i = 0; i < finalData.length; i += 4) {
        if (finalData[i + 3] > 0) {
            // Boost color channels
            finalData[i] = Math.min(255, finalData[i] * 1.5);
            finalData[i + 1] = Math.min(255, finalData[i + 1] * 1.5);
            finalData[i + 2] = Math.min(255, finalData[i + 2] * 1.5);
            
            // Apply irregular edge mask
            const pixelX = (i / 4) % size;
            const pixelY = Math.floor((i / 4) / size);
            
            // Calculate angle and distance from center
            const dx = (pixelX - size/2) / (size/2);
            const dy = (pixelY - size/2) / (size/2);
            const angle = (Math.atan2(dy, dx) + Math.PI) * 180 / Math.PI; // 0-360
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            
            // Get the edge distance for this angle
            const angleIndex = Math.floor(angle) % 360;
            const edgeDistance = edgeNoise[angleIndex];
            
            // Apply irregular edge
            if (distFromCenter > edgeDistance) {
                finalData[i + 3] = 0; // Outside the irregular edge
            }
            // Gradual falloff near the edge
            else if (distFromCenter > edgeDistance - 0.15) {
                const edgeFalloff = (edgeDistance - distFromCenter) / 0.15;
                finalData[i + 3] = Math.floor(finalData[i + 3] * edgeFalloff);
            }
        }
    }
}

//==============================================================================================
/**
 * Simple noise function (not true simplex but similar effect)
 * @param {number} x - X coordinate 
 * @param {number} y - Y coordinate
 * @param {number} seed - Random seed
 * @returns {number} Noise value from -1 to 1
 */
function simplexLikeNoise(x: number, y: number, seed: number = 0): number {
    // Simple deterministic noise function
    const n = Math.sin(x + y * 113 + seed * 157) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
} 