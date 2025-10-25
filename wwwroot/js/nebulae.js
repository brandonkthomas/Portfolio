/**
 * nebulae.js
 * @fileoverview Contains functions for creating and updating nebulae in the starfield
 */

import { createNebulaTexture } from './textures.js';
import { isErrorPage } from './common.js';

// Store original opacity values for restoration
const nebulaOriginalOpacities = new WeakMap();

//==============================================================================================
/**
 * Creates nebula/dust cloud meshes
 * @param {number} nebulaCount - Number of nebulae to create
 * @param {THREE.Scene} scene - The scene to add nebulae to
 * @returns {Array} Array of nebula objects
 */
export function createNebulae(nebulaCount, scene) {
    const nebulae = [];
    const isError = isErrorPage();
    
    // Track distribution
    const existingPositions = [];
    
    for (let i = 0; i < nebulaCount; i++) {
        // Create cloud-like sprite texture with irregular shape
        const texture = createNebulaTexture(false, i % 5); // Pass type parameter for shape variation
        
        // Create sprite with properly configured material for visibility without blocking stars
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            opacity: (0.005 + Math.random() * 0.005) * (isError ? 0.5 : 1.0),
            depthTest: false,
            depthWrite: false
        });
        
        // Create color with higher brightness to make nebulae visible at low opacity (counteract the additive blending)
        const hue = Math.random();
        const color = new THREE.Color();
        
        color.setHSL(hue, 0.2 + Math.random() * 0.2, 0.7 + Math.random() * 0.2);
        material.color = color;
        
        const sprite = new THREE.Sprite(material);
        
        // Position nebulae throughout scene
        let x, y, z, isValidPosition = false;
        let attempts = 0;
        
        // Try to find position not too close to existing nebulae
        do {
            z = -75 + Math.random() * 60;
            const radius = 3 + Math.random() * 30; // Wider radius range for better spread
            const theta = Math.random() * Math.PI * 2;
            x = radius * Math.cos(theta);
            y = radius * Math.sin(theta);
            
            // Check if this position is far enough from existing nebulae
            isValidPosition = true;
            const minDistanceSquared = 100; // Minimum squared distance between centers
            
            for (const pos of existingPositions) {
                const dx = x - pos.x;
                const dy = y - pos.y;
                const dz = z - pos.z;
                const distSquared = dx*dx + dy*dy + dz*dz;
                
                if (distSquared < minDistanceSquared) {
                    isValidPosition = false;
                    break;
                }
            }
            
            attempts++;
        } while (!isValidPosition && attempts < 10); // Limit attempts to avoid infinite loops
        
        // Store (then set) position
        existingPositions.push({x, y, z});
        sprite.position.set(x, y, z);
        
        // Non-uniform scaling for more organic shapes
        const baseScale = 5 + Math.random() * 10;
        const xScale = baseScale * (0.7 + Math.random() * 0.6);
        const yScale = baseScale * (0.7 + Math.random() * 0.6);
        sprite.scale.set(xScale, yScale, 1);
        
        // Random rotation for more varied appearance
        sprite.rotation.z = Math.random() * Math.PI * 2;
        
        // Random speed (even slower for background elements)
        const speed = 0.004 + Math.random() * 0.016;
        
        // Store original opacity in WeakMap for safe restoration
        nebulaOriginalOpacities.set(sprite.material, sprite.material.opacity);
        
        nebulae.push({
            mesh: sprite,
            speed: speed,
            originalSpeed: speed,
            // Store random values for organic movement
            rotationSpeed: (Math.random() - 0.5) * 0.01,
            pulseSpeed: 0.2 + Math.random() * 0.3,
            pulseAmount: 0.05 + Math.random() * 0.1,
            initialScale: {x: xScale, y: yScale},
            // Add wobble for more organic movement
            wobbleX: 0.1 + Math.random() * 0.2,
            wobbleY: 0.1 + Math.random() * 0.2,
            wobbleSpeed: 0.2 + Math.random() * 0.5
        });
        
        scene.add(sprite);
    }
    
    // Clear existing positions list before adding background nebulae
    existingPositions.length = 0;
    
    // Add a few larger, more distant nebula clouds for depth
    for (let i = 0; i < nebulaCount/2; i++) {
        const texture = createNebulaTexture(true, i % 5); // Pass shape type
        
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            opacity: (0.015 + Math.random() * 0.01) * (isError ? 0.5 : 1.0),
            depthTest: false,
            depthWrite: false
        });
        
        // More teal/blue/purple tones for distant nebulae with higher brightness
        const hue = 0.5 + (Math.random() * 0.3);
        const color = new THREE.Color();
        color.setHSL(hue, 0.2 + Math.random() * 0.1, 0.6 + Math.random() * 0.2);
        material.color = color;
        
        const sprite = new THREE.Sprite(material);
        
        // Position with better spacing
        let x, y, z, isValidPosition = false;
        let attempts = 0;
        
        do {
            z = -100 + Math.random() * 40;
            const radius = 10 + Math.random() * 35; // Wider radius for better spread
            const theta = Math.random() * Math.PI * 2;
            x = radius * Math.cos(theta);
            y = radius * Math.sin(theta);
            
            isValidPosition = true;
            const minDistanceSquared = 250; // Larger minimum distance for background nebulae
            
            for (const pos of existingPositions) {
                const dx = x - pos.x;
                const dy = y - pos.y;
                const dz = z - pos.z;
                const distSquared = dx*dx + dy*dy + dz*dz;
                
                if (distSquared < minDistanceSquared) {
                    isValidPosition = false;
                    break;
                }
            }
            
            attempts++;
        } while (!isValidPosition && attempts < 10);
        
        existingPositions.push({x, y, z});
        
        sprite.position.set(x, y, z);
        
        // Non-uniform scaling for background elements too
        const baseScale = 15 + Math.random() * 20;
        const xScale = baseScale * (0.7 + Math.random() * 0.6);
        const yScale = baseScale * (0.7 + Math.random() * 0.6);
        sprite.scale.set(xScale, yScale, 1);
        
        // Random rotation
        sprite.rotation.z = Math.random() * Math.PI * 2;
        
        // Very slow speed for background elements
        const speed = 0.001 + Math.random() * 0.005;
        
        // Store original opacity in WeakMap for safe restoration
        nebulaOriginalOpacities.set(sprite.material, sprite.material.opacity);
        
        nebulae.push({
            mesh: sprite,
            speed: speed,
            originalSpeed: speed,
            rotationSpeed: (Math.random() - 0.5) * 0.005,
            pulseSpeed: 0.1 + Math.random() * 0.2,
            pulseAmount: 0.03 + Math.random() * 0.05,
            initialScale: {x: xScale, y: yScale},
            // Add subtle wobble
            wobbleX: 0.05 + Math.random() * 0.1,
            wobbleY: 0.05 + Math.random() * 0.1,
            wobbleSpeed: 0.1 + Math.random() * 0.3
        });
        
        scene.add(sprite);
    }
    
    return nebulae;
}

//==============================================================================================
/**
 * Update nebula positions and appearance
 * @param {Array} nebulae - Array of nebula objects to update
 * @param {number} deltaTime - Time since last frame in seconds
 * @param {number} warpIntensity - Current warp effect intensity (0-1)
 * @param {number} starDirection - 1 for forward (toward camera), -1 for reverse (away from camera)
 */
export function updateNebulae(nebulae, deltaTime, warpIntensity, starDirection = 1) {
    const time = performance.now() * 0.001; // Current time in seconds for animation
    const absWarpIntensity = Math.abs(warpIntensity);
    const direction = starDirection >= 0 ? 1 : -1;
    
    for (let i = 0; i < nebulae.length; i++) {
        const nebula = nebulae[i];
        
        // Calculate warp speed for nebulae (increases during warp)
        const warpSpeed = nebula.originalSpeed * (1 + absWarpIntensity * 120);
        
        // Move nebula based on star direction
        nebula.mesh.position.z += warpSpeed * deltaTime * 60 * direction;
        
        // Apply subtle organic movement
        nebula.mesh.rotation.z += nebula.rotationSpeed * deltaTime;
        
        // Subtle pulsing/breathing effect
        const pulse = Math.sin(time * nebula.pulseSpeed) * nebula.pulseAmount;
        
        // Apply non-uniform wobble for more organic feel
        const wobbleX = Math.sin(time * nebula.wobbleSpeed) * nebula.wobbleX;
        const wobbleY = Math.cos(time * nebula.wobbleSpeed * 0.7) * nebula.wobbleY;
        
        // Scale effect during warp
        const stretchFactor = 1 + absWarpIntensity * 1.5;
        
        // Apply non-uniform scaling for more organic feel
        nebula.mesh.scale.x = nebula.initialScale.x * (1 + pulse + wobbleX);
        nebula.mesh.scale.y = nebula.initialScale.y * (1 + pulse + wobbleY);
        nebula.mesh.scale.z = Math.min(nebula.initialScale.x, nebula.initialScale.y) * stretchFactor;
        
        // Reset nebula based on direction
        if (direction > 0) {
            // Forward: reset when too close to camera
            if (nebula.mesh.position.z > 10) {
                nebula.mesh.position.z = -85 - Math.random() * 30; // More varied and further back
                
                // New random position
                const radius = 3 + Math.random() * 25;
                const theta = Math.random() * Math.PI * 2;
                nebula.mesh.position.x = radius * Math.cos(theta);
                nebula.mesh.position.y = radius * Math.sin(theta);
                
                // Randomize scale again for variety
                const baseScale = i < nebulae.length/1.5 ? 
                    (5 + Math.random() * 10) : 
                    (15 + Math.random() * 20);
                    
                const xScale = baseScale * (0.7 + Math.random() * 0.6);
                const yScale = baseScale * (0.7 + Math.random() * 0.6);
                nebula.initialScale = {x: xScale, y: yScale};
                nebula.mesh.scale.set(xScale, yScale, 1);
                
                // New random opacity (visible but won't block stars due to material settings)
                const baseOpacity = i < nebulae.length/1.5 ? 0.02 : 0.015;
                nebula.mesh.material.opacity = baseOpacity + Math.random() * 0.02;
                
                // Create new texture with different shape
                nebula.mesh.material.map = createNebulaTexture(
                    i >= nebulae.length/1.5, // background flag
                    Math.floor(Math.random() * 5) // random shape type
                );
                nebula.mesh.material.map.needsUpdate = true;
                
                // Fade in effect
                if (absWarpIntensity < 0.05) {
                    nebula.mesh.material.opacity = 0;  // Will fade in during animation
                }
            }
        } else {
            // Reverse: reset when too far back
            if (nebula.mesh.position.z < -115) {
                nebula.mesh.position.z = 10; // Bring to front
                
                // New random position
                const radius = 3 + Math.random() * 25;
                const theta = Math.random() * Math.PI * 2;
                nebula.mesh.position.x = radius * Math.cos(theta);
                nebula.mesh.position.y = radius * Math.sin(theta);
                
                // Randomize scale again for variety
                const baseScale = i < nebulae.length/1.5 ? 
                    (5 + Math.random() * 10) : 
                    (15 + Math.random() * 20);
                    
                const xScale = baseScale * (0.7 + Math.random() * 0.6);
                const yScale = baseScale * (0.7 + Math.random() * 0.6);
                nebula.initialScale = {x: xScale, y: yScale};
                nebula.mesh.scale.set(xScale, yScale, 1);
                
                // New random opacity (visible but won't block stars due to material settings)
                const baseOpacity = i < nebulae.length/1.5 ? 0.02 : 0.015;
                nebula.mesh.material.opacity = baseOpacity + Math.random() * 0.02;
                
                // Create new texture with different shape
                nebula.mesh.material.map = createNebulaTexture(
                    i >= nebulae.length/1.5, // background flag
                    Math.floor(Math.random() * 5) // random shape type
                );
                nebula.mesh.material.map.needsUpdate = true;
                
                // Fade in effect
                if (absWarpIntensity < 0.05) {
                    nebula.mesh.material.opacity = 0;  // Will fade in during animation
                }
            }
        }
        
        // Handle fade in effect when not warping (slower for nebulae)
        if (absWarpIntensity < 0.05 && nebula.mesh.material.opacity < 0.04) {
            nebula.mesh.material.opacity = Math.min(0.04, nebula.mesh.material.opacity + 0.01 * deltaTime);
        }
        
        // Increase color saturation / lightness during warp
        const material = nebula.mesh.material;
        const hsl = {};
        material.color.getHSL(hsl);
        
        // Keep base saturation low but increase lightness to compensate for very low opacity
        const targetSaturation = 0.2 + Math.min(0.4, absWarpIntensity * 0.5);
        const targetLightness = 0.7 + Math.min(0.3, absWarpIntensity * 0.3);
        
        const newSaturation = hsl.s + (targetSaturation - hsl.s) * 0.1;
        const newLightness = hsl.l + (targetLightness - hsl.l) * 0.1;
        
        material.color.setHSL(hsl.h, newSaturation, newLightness);
    }
}

//==============================================================================================
/**
 * Reduce nebula opacity -- for state changes (photo gallery view)
 * @param {Array} nebulae - Array of nebula objects
 * @param {number} factor - Reduction factor (default 0.3)
 */
export function reduceNebulaOpacity(nebulae, factor = 0.3) {
    nebulae.forEach(nebula => {
        if (nebula && nebula.mesh && nebula.mesh.material) {
            const material = nebula.mesh.material;
            
            // Store current opacity as original if not already stored
            if (!nebulaOriginalOpacities.has(material)) {
                nebulaOriginalOpacities.set(material, material.opacity);
            }
            
            // Set to reduced opacity
            const originalOpacity = nebulaOriginalOpacities.get(material);
            material.opacity = originalOpacity * factor;
        }
    });
}

//==============================================================================================
/**
 * Restore nebula opacity to original values -- for state changes (card view)
 * @param {Array} nebulae - Array of nebula objects
 */
export function restoreNebulaOpacity(nebulae) {
    nebulae.forEach(nebula => {
        if (nebula && nebula.mesh && nebula.mesh.material) {
            const material = nebula.mesh.material;
            
            // Restore from stored original opacity
            if (nebulaOriginalOpacities.has(material)) {
                material.opacity = nebulaOriginalOpacities.get(material);
            }
        }
    });
} 