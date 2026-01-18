// ============================================================
// VOID SUPREMACY 3D - LOD (Level of Detail) Manager
// Manages distance-based mesh detail switching for performance
// ============================================================

import { GRAPHICS_SETTINGS, graphicsLevel } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';

/**
 * LOD Levels enum
 */
export const LOD_LEVELS = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
    BILLBOARD: 3
};

/**
 * LODManager - Manages Level of Detail for all tracked meshes
 * Switches between detail levels based on camera distance
 */
class LODManagerClass {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.enabled = false;

        // Tracked entities with LOD meshes
        this.trackedEntities = new Map(); // entityId -> LODEntry

        // Settings cache
        this.settings = null;

        // Update frequency
        this.updateInterval = 100; // ms between LOD updates
        this.lastUpdate = 0;

        // Billboard cache
        this.billboardMaterial = null;
        this.billboardMeshes = new Map(); // unitType -> billboard mesh template
    }

    /**
     * Initialize the LOD manager
     */
    init(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        this.updateSettings();

        // Listen for graphics quality changes
        eventBus.on(GameEvents.GRAPHICS_QUALITY_CHANGED, () => {
            this.updateSettings();
        });

        // Create billboard material
        this.createBillboardMaterial();

        console.log(`LODManager: Initialized (enabled: ${this.enabled})`);
    }

    /**
     * Update LOD settings from graphics config
     */
    updateSettings() {
        const graphics = GRAPHICS_SETTINGS[graphicsLevel];
        this.settings = graphics?.lod || GRAPHICS_SETTINGS.MEDIUM.lod;
        this.enabled = this.settings.enabled;
    }

    /**
     * Create billboard material for very distant units
     */
    createBillboardMaterial() {
        if (!this.scene) return;

        this.billboardMaterial = new BABYLON.StandardMaterial('lod_billboard', this.scene);
        this.billboardMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        this.billboardMaterial.disableLighting = true;
        this.billboardMaterial.alpha = 0.9;
    }

    /**
     * Register an entity for LOD management
     * @param {string} entityId - Unique entity identifier
     * @param {Object} lodMeshes - { high: Mesh, medium: Mesh, low: Mesh }
     * @param {BABYLON.Vector3} position - Entity position
     * @param {number} size - Entity size for billboard scaling
     * @param {BABYLON.Color3} color - Team color for billboard
     */
    register(entityId, lodMeshes, position, size = 1, color = null) {
        if (!this.enabled) return;

        const entry = {
            meshes: lodMeshes,
            position: position,
            size: size,
            color: color,
            currentLevel: LOD_LEVELS.HIGH,
            billboard: null
        };

        // Create billboard for this entity
        if (color) {
            entry.billboard = this.createBillboard(entityId, size, color);
            entry.billboard.isVisible = false;
        }

        // Start with high detail visible
        this.setLODLevel(entry, LOD_LEVELS.HIGH);

        this.trackedEntities.set(entityId, entry);
    }

    /**
     * Create a billboard imposter for very distant units
     */
    createBillboard(entityId, size, color) {
        const billboard = BABYLON.MeshBuilder.CreatePlane(`billboard_${entityId}`, {
            width: size * 2,
            height: size * 2
        }, this.scene);

        billboard.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        // Create colored material
        const mat = new BABYLON.StandardMaterial(`billboard_mat_${entityId}`, this.scene);
        mat.emissiveColor = color;
        mat.disableLighting = true;
        mat.alpha = 0.8;

        billboard.material = mat;
        billboard.isPickable = false;

        return billboard;
    }

    /**
     * Unregister an entity from LOD management
     */
    unregister(entityId) {
        const entry = this.trackedEntities.get(entityId);
        if (entry) {
            // Dispose billboard
            if (entry.billboard) {
                if (entry.billboard.material) {
                    entry.billboard.material.dispose();
                }
                entry.billboard.dispose();
            }
            this.trackedEntities.delete(entityId);
        }
    }

    /**
     * Update entity position (call when entity moves)
     */
    updatePosition(entityId, position) {
        const entry = this.trackedEntities.get(entityId);
        if (entry) {
            entry.position = position;
            if (entry.billboard) {
                entry.billboard.position = position;
            }
        }
    }

    /**
     * Update all LOD levels based on camera distance
     * Call this every frame or at regular intervals
     */
    update() {
        if (!this.enabled || !this.camera) return;

        const now = performance.now();
        if (now - this.lastUpdate < this.updateInterval) return;
        this.lastUpdate = now;

        const cameraPos = this.camera.position;

        for (const [entityId, entry] of this.trackedEntities) {
            const distance = BABYLON.Vector3.Distance(cameraPos, entry.position);
            const newLevel = this.calculateLODLevel(distance);

            if (newLevel !== entry.currentLevel) {
                this.setLODLevel(entry, newLevel);
            }

            // Update billboard position
            if (entry.billboard && entry.currentLevel === LOD_LEVELS.BILLBOARD) {
                entry.billboard.position.copyFrom(entry.position);
            }
        }
    }

    /**
     * Calculate which LOD level to use based on distance
     */
    calculateLODLevel(distance) {
        if (distance < this.settings.highDetailDistance) {
            return LOD_LEVELS.HIGH;
        } else if (distance < this.settings.mediumDetailDistance) {
            return LOD_LEVELS.MEDIUM;
        } else if (distance < this.settings.lowDetailDistance) {
            return LOD_LEVELS.LOW;
        } else {
            return LOD_LEVELS.BILLBOARD;
        }
    }

    /**
     * Set the LOD level for an entry
     */
    setLODLevel(entry, level) {
        const { meshes, billboard } = entry;

        // Hide all meshes first
        if (meshes.high) meshes.high.isVisible = false;
        if (meshes.medium) meshes.medium.isVisible = false;
        if (meshes.low) meshes.low.isVisible = false;
        if (billboard) billboard.isVisible = false;

        // Show appropriate mesh
        switch (level) {
            case LOD_LEVELS.HIGH:
                if (meshes.high) meshes.high.isVisible = true;
                else if (meshes.medium) meshes.medium.isVisible = true;
                else if (meshes.low) meshes.low.isVisible = true;
                break;

            case LOD_LEVELS.MEDIUM:
                if (meshes.medium) meshes.medium.isVisible = true;
                else if (meshes.high) meshes.high.isVisible = true;
                else if (meshes.low) meshes.low.isVisible = true;
                break;

            case LOD_LEVELS.LOW:
                if (meshes.low) meshes.low.isVisible = true;
                else if (meshes.medium) meshes.medium.isVisible = true;
                else if (meshes.high) meshes.high.isVisible = true;
                break;

            case LOD_LEVELS.BILLBOARD:
                if (billboard) {
                    billboard.isVisible = true;
                } else if (meshes.low) {
                    meshes.low.isVisible = true;
                } else if (meshes.medium) {
                    meshes.medium.isVisible = true;
                }
                break;
        }

        entry.currentLevel = level;
    }

    /**
     * Force all entities to a specific LOD level (for debugging)
     */
    forceLevel(level) {
        for (const entry of this.trackedEntities.values()) {
            this.setLODLevel(entry, level);
        }
    }

    /**
     * Get statistics about current LOD distribution
     */
    getStats() {
        const stats = {
            total: this.trackedEntities.size,
            high: 0,
            medium: 0,
            low: 0,
            billboard: 0
        };

        for (const entry of this.trackedEntities.values()) {
            switch (entry.currentLevel) {
                case LOD_LEVELS.HIGH: stats.high++; break;
                case LOD_LEVELS.MEDIUM: stats.medium++; break;
                case LOD_LEVELS.LOW: stats.low++; break;
                case LOD_LEVELS.BILLBOARD: stats.billboard++; break;
            }
        }

        return stats;
    }

    /**
     * Dispose the LOD manager
     */
    dispose() {
        // Dispose all billboards
        for (const entry of this.trackedEntities.values()) {
            if (entry.billboard) {
                if (entry.billboard.material) {
                    entry.billboard.material.dispose();
                }
                entry.billboard.dispose();
            }
        }

        this.trackedEntities.clear();

        if (this.billboardMaterial) {
            this.billboardMaterial.dispose();
        }

        console.log('LODManager: Disposed');
    }
}

/**
 * LODMeshBuilder - Helper class for creating LOD mesh variants
 */
export class LODMeshBuilder {
    /**
     * Create LOD variants of a ship mesh
     * @param {Function} createHighDetail - Function that creates high detail mesh
     * @param {Function} createMediumDetail - Function that creates medium detail mesh
     * @param {Function} createLowDetail - Function that creates low detail mesh
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {Object} - { high: Mesh, medium: Mesh, low: Mesh }
     */
    static createLODMeshes(createHighDetail, createMediumDetail, createLowDetail, scene) {
        return {
            high: createHighDetail ? createHighDetail(scene) : null,
            medium: createMediumDetail ? createMediumDetail(scene) : null,
            low: createLowDetail ? createLowDetail(scene) : null
        };
    }

    /**
     * Create a simple low-detail imposter (box or sphere)
     * @param {string} name - Mesh name
     * @param {number} size - Approximate size
     * @param {string} shape - 'box' or 'sphere'
     * @param {BABYLON.Scene} scene - Babylon scene
     * @returns {BABYLON.Mesh}
     */
    static createImposter(name, size, shape = 'box', scene) {
        if (shape === 'sphere') {
            return BABYLON.MeshBuilder.CreateSphere(name, {
                diameter: size,
                segments: 4
            }, scene);
        }

        return BABYLON.MeshBuilder.CreateBox(name, {
            width: size * 0.5,
            height: size * 0.4,
            depth: size * 1.2
        }, scene);
    }

    /**
     * Create reduced-poly version by decimating a mesh
     * Note: This requires mesh optimization which may not be available in all Babylon.js builds
     * @param {BABYLON.Mesh} sourceMesh - Original mesh
     * @param {number} reduction - Reduction ratio (0.5 = 50% reduction)
     * @returns {BABYLON.Mesh}
     */
    static createDecimatedMesh(sourceMesh, reduction) {
        // Clone the mesh
        const decimated = sourceMesh.clone(`${sourceMesh.name}_lod`);

        // If mesh simplification is available, use it
        if (BABYLON.SimplificationQueue && decimated.simplify) {
            const settings = new BABYLON.ISimplificationSettings(
                reduction,
                BABYLON.SimplificationType.QUADRATIC
            );
            decimated.simplify([settings]);
        }

        return decimated;
    }
}

// Singleton export
export const LODManager = new LODManagerClass();
export default LODManager;
