// ============================================================
// VOID SUPREMACY 3D - Fog of War System
// Visibility management with explored/visible states
// ============================================================

import { CONFIG, TEAMS, BUILDINGS, UNITS } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { gameState } from '../core/GameState.js?v=20260119';

// Visibility states
export const Visibility = {
    UNEXPLORED: 0,   // Never seen
    EXPLORED: 1,     // Was seen but not currently visible
    VISIBLE: 2       // Currently visible
};

export class FogOfWar {
    constructor() {
        this.gridSize = 10; // Size of each fog cell in world units
        this.gridWidth = 0;
        this.gridHeight = 0;

        // Visibility data per team
        this.visibility = new Map(); // team -> Uint8Array
        this.explored = new Map();   // team -> Uint8Array (permanent explored state)

        this.enabled = false; // Disabled until rendering is fixed
        this.scene = null;
        this.fogMesh = null;
        this.fogTexture = null;
        this.fogCanvas = null;
        this.fogCtx = null;

        // Vision ranges for different entity types
        this.visionRanges = {
            // Buildings
            commandCenter: 120,
            powerPlant: 60,
            refinery: 70,
            shipyard: 80,
            advancedShipyard: 90,
            turret: 80,
            supplyDepot: 50,
            radar: 200, // Radar has extended vision

            // Units
            harvester: 60,
            scout: 100,
            interceptor: 70,
            striker: 70,
            heavy: 60,
            bomber: 50,
            gunship: 65,
            frigate: 80,
            cruiser: 90,
            battlecruiser: 100,
            dreadnought: 120,

            // Aliens
            guardian: 80,
            sentinel: 100
        };
    }

    init(scene) {
        this.scene = scene;

        // Calculate grid dimensions
        this.gridWidth = Math.ceil(CONFIG.MAP_SIZE / this.gridSize);
        this.gridHeight = Math.ceil(CONFIG.MAP_SIZE / this.gridSize);
        const totalCells = this.gridWidth * this.gridHeight;

        // Initialize visibility for each team
        for (let team = 0; team <= 5; team++) {
            this.visibility.set(team, new Uint8Array(totalCells));
            this.explored.set(team, new Uint8Array(totalCells));
        }

        // Create fog rendering (only if enabled)
        if (this.enabled) {
            this.createFogMesh();
        }

        // Listen for entity events
        this.setupEventListeners();

        console.log(`Fog of War initialized: ${this.gridWidth}x${this.gridHeight} grid`);
    }

    createFogMesh() {
        // Create a canvas for the fog texture
        this.fogCanvas = document.createElement('canvas');
        this.fogCanvas.width = this.gridWidth;
        this.fogCanvas.height = this.gridHeight;
        this.fogCtx = this.fogCanvas.getContext('2d');

        // Create dynamic texture from canvas
        this.fogTexture = new BABYLON.DynamicTexture('fogTexture', {
            width: this.gridWidth,
            height: this.gridHeight
        }, this.scene, false);

        // Create fog plane that covers the map
        this.fogMesh = BABYLON.MeshBuilder.CreateGround('fogOfWar', {
            width: CONFIG.MAP_SIZE,
            height: CONFIG.MAP_SIZE
        }, this.scene);
        this.fogMesh.position.y = 50; // Above all units

        // Create fog material
        const fogMat = new BABYLON.StandardMaterial('fogMat', this.scene);
        fogMat.diffuseTexture = this.fogTexture;
        fogMat.emissiveTexture = this.fogTexture;
        fogMat.useAlphaFromDiffuseTexture = true;
        fogMat.alpha = 1;
        fogMat.backFaceCulling = false;
        this.fogMesh.material = fogMat;

        // Make fog non-pickable
        this.fogMesh.isPickable = false;
    }

    setupEventListeners() {
        // Update visibility when entities move or are created
        // Store unsubscribe functions for cleanup
        this._unsubs = [
            eventBus.on(GameEvents.ENTITY_CREATED, () => this.markDirty()),
            eventBus.on(GameEvents.ENTITY_DESTROYED, () => this.markDirty())
        ];
    }

    markDirty() {
        this._dirty = true;
    }

    // ===== Coordinate Conversion =====

    worldToGrid(x, z) {
        const gx = Math.floor((x + CONFIG.MAP_SIZE / 2) / this.gridSize);
        const gz = Math.floor((z + CONFIG.MAP_SIZE / 2) / this.gridSize);
        return {
            x: Math.max(0, Math.min(this.gridWidth - 1, gx)),
            z: Math.max(0, Math.min(this.gridHeight - 1, gz))
        };
    }

    gridToWorld(gx, gz) {
        return {
            x: (gx * this.gridSize) - CONFIG.MAP_SIZE / 2 + this.gridSize / 2,
            z: (gz * this.gridSize) - CONFIG.MAP_SIZE / 2 + this.gridSize / 2
        };
    }

    getIndex(gx, gz) {
        return gz * this.gridWidth + gx;
    }

    // ===== Visibility Calculation =====

    update() {
        if (!this.enabled) return;

        // Clear current visibility (keep explored)
        for (let team = 0; team <= 5; team++) {
            const vis = this.visibility.get(team);
            const exp = this.explored.get(team);

            // Reset visibility to explored state
            for (let i = 0; i < vis.length; i++) {
                vis[i] = exp[i] > 0 ? Visibility.EXPLORED : Visibility.UNEXPLORED;
            }
        }

        // Calculate visibility from all entities
        for (const entity of gameState.entities) {
            if (entity.dead || !entity.mesh) continue;

            const pos = entity.mesh.position;
            const visionRange = this.getVisionRange(entity);

            this.revealArea(entity.team, pos.x, pos.z, visionRange);
        }

        // Update fog texture for player's view
        this.renderFog(TEAMS.PLAYER);
    }

    getVisionRange(entity) {
        // Get base vision range
        let range = this.visionRanges[entity.type] || 60;

        // Buildings under construction have reduced vision
        if (entity.isBuilding && entity.isConstructing) {
            range *= 0.5;
        }

        return range;
    }

    revealArea(team, worldX, worldZ, radius) {
        const vis = this.visibility.get(team);
        const exp = this.explored.get(team);
        if (!vis || !exp) return;

        const center = this.worldToGrid(worldX, worldZ);
        const gridRadius = Math.ceil(radius / this.gridSize);

        // Pre-compute squared values outside the loop
        const gridSizeSquared = this.gridSize * this.gridSize;
        const radiusSquared = radius * radius;

        // Reveal cells within radius
        for (let dz = -gridRadius; dz <= gridRadius; dz++) {
            for (let dx = -gridRadius; dx <= gridRadius; dx++) {
                const gx = center.x + dx;
                const gz = center.z + dz;

                if (gx < 0 || gx >= this.gridWidth || gz < 0 || gz >= this.gridHeight) continue;

                // Check if within circular radius (using squared distance to avoid sqrt)
                const distSquared = (dx * dx + dz * dz) * gridSizeSquared;
                if (distSquared <= radiusSquared) {
                    const idx = this.getIndex(gx, gz);
                    vis[idx] = Visibility.VISIBLE;
                    exp[idx] = 1; // Mark as permanently explored
                }
            }
        }
    }

    // ===== Fog Rendering =====

    renderFog(team) {
        const vis = this.visibility.get(team);
        if (!vis || !this.fogCtx) return;

        const ctx = this.fogCtx;
        const imageData = ctx.createImageData(this.gridWidth, this.gridHeight);
        const data = imageData.data;

        for (let i = 0; i < vis.length; i++) {
            const idx = i * 4;
            const state = vis[i];

            if (state === Visibility.UNEXPLORED) {
                // Black fog
                data[idx] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 5;
                data[idx + 3] = 230; // Almost opaque
            } else if (state === Visibility.EXPLORED) {
                // Dark gray fog (explored but not visible)
                data[idx] = 10;
                data[idx + 1] = 10;
                data[idx + 2] = 20;
                data[idx + 3] = 150; // Semi-transparent
            } else {
                // Visible - fully transparent
                data[idx] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
                data[idx + 3] = 0;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Update Babylon texture
        const texture = this.fogTexture;
        const texCtx = texture.getContext();
        texCtx.drawImage(this.fogCanvas, 0, 0);
        texture.update();
    }

    // ===== Visibility Queries =====

    isVisible(team, worldX, worldZ) {
        if (!this.enabled) return true;

        const vis = this.visibility.get(team);
        if (!vis) return true;

        const grid = this.worldToGrid(worldX, worldZ);
        const idx = this.getIndex(grid.x, grid.z);

        return vis[idx] === Visibility.VISIBLE;
    }

    isExplored(team, worldX, worldZ) {
        if (!this.enabled) return true;

        const exp = this.explored.get(team);
        if (!exp) return true;

        const grid = this.worldToGrid(worldX, worldZ);
        const idx = this.getIndex(grid.x, grid.z);

        return exp[idx] > 0;
    }

    getVisibilityState(team, worldX, worldZ) {
        if (!this.enabled) return Visibility.VISIBLE;

        const vis = this.visibility.get(team);
        if (!vis) return Visibility.VISIBLE;

        const grid = this.worldToGrid(worldX, worldZ);
        const idx = this.getIndex(grid.x, grid.z);

        return vis[idx];
    }

    // Check if an entity is visible to a team
    isEntityVisible(team, entity) {
        if (!this.enabled) return true;
        if (entity.team === team) return true; // Always see own units

        const pos = entity.mesh?.position;
        if (!pos) return false;

        return this.isVisible(team, pos.x, pos.z);
    }

    // ===== Entity Visibility Updates =====

    updateEntityVisibility() {
        if (!this.enabled) return;

        for (const entity of gameState.entities) {
            if (entity.dead || !entity.mesh) continue;

            // Check if visible to player
            const visible = this.isEntityVisible(TEAMS.PLAYER, entity);

            // Update entity mesh visibility
            if (entity.team !== TEAMS.PLAYER) {
                entity.mesh.setEnabled(visible);
            }
        }

        // Update resource nodes visibility
        for (const ore of gameState.oreNodes) {
            if (ore.mesh) {
                const visible = this.isVisible(TEAMS.PLAYER, ore.x, ore.z);
                ore.mesh.setEnabled(visible && !ore.depleted);
            }
        }

        for (const crystal of gameState.crystalNodes) {
            if (crystal.mesh) {
                const visible = this.isVisible(TEAMS.PLAYER, crystal.x, crystal.z);
                crystal.mesh.setEnabled(visible && !crystal.depleted);
            }
        }
    }

    // ===== Reveal Commands =====

    revealAll(team) {
        const exp = this.explored.get(team);
        if (exp) {
            exp.fill(1);
        }
        this.update();
    }

    revealMap() {
        // Reveal entire map for all teams (debug/cheat)
        for (let team = 0; team <= 5; team++) {
            this.revealAll(team);
        }
    }

    // ===== Controls =====

    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.fogMesh) {
            this.fogMesh.setEnabled(enabled);
        }
        if (!enabled) {
            // Show all entities
            for (const entity of gameState.entities) {
                if (entity.mesh) {
                    entity.mesh.setEnabled(!entity.dead);
                }
            }
        }
    }

    toggle() {
        this.setEnabled(!this.enabled);
    }

    dispose() {
        // Unsubscribe from event bus listeners
        this._unsubs?.forEach(unsub => unsub?.());
        this._unsubs = null;

        if (this.fogMesh) {
            this.fogMesh.dispose();
        }
        if (this.fogTexture) {
            this.fogTexture.dispose();
        }
        this.visibility.clear();
        this.explored.clear();
    }
}

export const fogOfWar = new FogOfWar();

export default FogOfWar;
