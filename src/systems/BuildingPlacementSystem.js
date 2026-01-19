// ============================================================
// VOID SUPREMACY 3D - Building Placement System
// Manages placement preview, ghost mesh, and range validation
// ============================================================

import { BUILDINGS, TEAMS, TEAM_COLORS } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { gameState } from '../core/GameState.js?v=20260119';

// Build range constant - must be within this distance of a friendly structure
const BUILD_RANGE = 150;

export class BuildingPlacementSystem {
    constructor() {
        this.scene = null;
        this.ghostMesh = null;
        this.ghostMaterial = null;
        this.rangeIndicators = [];
        this.isValidPlacement = false;
        this.currentBuildingType = null;
    }

    init(scene) {
        this.scene = scene;
        this.ghostMesh = null;
        this.ghostMaterial = null;
        this.rangeIndicators = [];
        this.isValidPlacement = false;
        this.currentBuildingType = null;

        // Listen for build mode exit to clear preview
        this._unsubs = [
            eventBus.on(GameEvents.UI_BUILD_MODE_EXIT, () => {
                this.clearPreview();
            }),
            eventBus.on(GameEvents.BUILDING_PLACEMENT_CANCEL, () => {
                this.clearPreview();
            })
        ];
    }

    /**
     * Update the placement preview at the cursor position
     * @param {Object} worldPos - World position {x, y, z}
     * @param {string} buildingType - The building type key from BUILDINGS
     * @param {number} team - The team placing the building
     */
    updatePreview(worldPos, buildingType, team) {
        if (!worldPos || !buildingType) {
            this.clearPreview();
            return;
        }

        const buildingDef = BUILDINGS[buildingType];
        if (!buildingDef) {
            this.clearPreview();
            return;
        }

        // If building type changed, recreate the ghost mesh
        if (this.currentBuildingType !== buildingType) {
            this.clearGhostMesh();
            this.currentBuildingType = buildingType;
            this.createGhostMesh(buildingType);
        }

        // Show range indicators when entering build mode
        if (this.rangeIndicators.length === 0) {
            this.showRangeIndicators(team);
        }

        // Update ghost position
        if (this.ghostMesh) {
            this.ghostMesh.position.x = worldPos.x;
            this.ghostMesh.position.z = worldPos.z;
            this.ghostMesh.position.y = 1; // Slightly above ground
        }

        // Check if placement is valid
        const validation = this.checkPlacementValid(worldPos.x, worldPos.z, team);
        this.isValidPlacement = validation.valid;

        // Update ghost color based on validity
        this.updateGhostColor(validation.valid);
    }

    /**
     * Create a ghost mesh for the building type
     * @param {string} buildingType - The building type key
     */
    createGhostMesh(buildingType) {
        if (!this.scene) return;

        const buildingDef = BUILDINGS[buildingType];
        if (!buildingDef) return;

        const size = buildingDef.size || 10;

        // Create a simple box representation of the building
        this.ghostMesh = BABYLON.MeshBuilder.CreateBox('buildingGhost', {
            width: size,
            height: size * 0.6,
            depth: size
        }, this.scene);

        this.ghostMesh.position.y = size * 0.3; // Half height

        // Create semi-transparent material
        this.ghostMaterial = new BABYLON.StandardMaterial('ghostMat', this.scene);
        this.ghostMaterial.alpha = 0.5;
        this.ghostMaterial.backFaceCulling = false;
        this.ghostMaterial.disableLighting = true;

        // Default to green (valid)
        this.ghostMaterial.emissiveColor = new BABYLON.Color3(0, 1, 0);
        this.ghostMaterial.diffuseColor = new BABYLON.Color3(0, 0.5, 0);

        this.ghostMesh.material = this.ghostMaterial;

        // Disable picking on ghost mesh
        this.ghostMesh.isPickable = false;
    }

    /**
     * Update the ghost mesh color based on placement validity
     * @param {boolean} valid - Whether the placement is valid
     */
    updateGhostColor(valid) {
        if (!this.ghostMaterial) return;

        if (valid) {
            // Green for valid placement
            this.ghostMaterial.emissiveColor = new BABYLON.Color3(0, 0.8, 0.2);
            this.ghostMaterial.diffuseColor = new BABYLON.Color3(0, 0.5, 0.1);
        } else {
            // Red for invalid placement
            this.ghostMaterial.emissiveColor = new BABYLON.Color3(1, 0.2, 0.2);
            this.ghostMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.1, 0.1);
        }
    }

    /**
     * Clear the ghost mesh only
     */
    clearGhostMesh() {
        if (this.ghostMesh) {
            this.ghostMesh.dispose();
            this.ghostMesh = null;
        }
        if (this.ghostMaterial) {
            this.ghostMaterial.dispose();
            this.ghostMaterial = null;
        }
        this.currentBuildingType = null;
    }

    /**
     * Clear all preview elements (ghost mesh and range indicators)
     */
    clearPreview() {
        this.clearGhostMesh();
        this.clearRangeIndicators();
        this.isValidPlacement = false;
    }

    /**
     * Show range indicator circles around all friendly buildings
     * @param {number} team - The team ID
     */
    showRangeIndicators(team) {
        this.clearRangeIndicators();

        if (!this.scene) return;

        const friendlyBuildings = gameState.entities.filter(e =>
            e.isBuilding && e.team === team && !e.dead
        );

        // Get team color for the indicators
        const teamColor = TEAM_COLORS[team] || TEAM_COLORS[0];

        for (const building of friendlyBuildings) {
            // Create a disc to show the build range
            const disc = BABYLON.MeshBuilder.CreateDisc('rangeIndicator', {
                radius: BUILD_RANGE,
                tessellation: 64
            }, this.scene);

            disc.position = new BABYLON.Vector3(
                building.mesh.position.x,
                0.5, // Slightly above ground
                building.mesh.position.z
            );

            // Lay the disc flat (rotate around X axis)
            disc.rotation.x = Math.PI / 2;

            // Create semi-transparent material
            const mat = new BABYLON.StandardMaterial('rangeMat_' + building.id, this.scene);
            mat.emissiveColor = new BABYLON.Color3(teamColor[0] * 0.5, teamColor[1] * 0.5 + 0.3, teamColor[2] * 0.2);
            mat.alpha = 0.12;
            mat.backFaceCulling = false;
            mat.disableLighting = true;
            disc.material = mat;

            // Disable picking
            disc.isPickable = false;

            this.rangeIndicators.push({ mesh: disc, material: mat });
        }
    }

    /**
     * Clear all range indicator meshes
     */
    clearRangeIndicators() {
        for (const indicator of this.rangeIndicators) {
            if (indicator.mesh) {
                indicator.mesh.dispose();
            }
            if (indicator.material) {
                indicator.material.dispose();
            }
        }
        this.rangeIndicators = [];
    }

    /**
     * Check if a position is valid for building placement
     * @param {number} x - World X coordinate
     * @param {number} z - World Z coordinate
     * @param {number} team - The team placing the building
     * @returns {Object} - { valid: boolean, reason?: string }
     */
    checkPlacementValid(x, z, team) {
        // Find all completed friendly buildings
        const friendlyBuildings = gameState.entities.filter(e =>
            e.isBuilding && e.team === team && !e.dead && !e.isConstructing
        );

        // First building (command center) is always allowed
        if (friendlyBuildings.length === 0) {
            return { valid: true };
        }

        // Check if within range of any friendly building
        for (const building of friendlyBuildings) {
            const dist = Math.hypot(
                building.mesh.position.x - x,
                building.mesh.position.z - z
            );
            if (dist <= BUILD_RANGE) {
                return { valid: true };
            }
        }

        return { valid: false, reason: 'Too far from existing structures' };
    }

    /**
     * Check if placement can proceed (call before placing)
     * @returns {boolean}
     */
    canPlace() {
        return this.isValidPlacement;
    }

    /**
     * Get the validation reason if placement is invalid
     * @param {number} x - World X coordinate
     * @param {number} z - World Z coordinate
     * @param {number} team - The team
     * @returns {string|null} - Error message or null if valid
     */
    getInvalidReason(x, z, team) {
        const validation = this.checkPlacementValid(x, z, team);
        return validation.valid ? null : validation.reason;
    }

    /**
     * Get the build range constant
     * @returns {number}
     */
    getBuildRange() {
        return BUILD_RANGE;
    }

    dispose() {
        this.clearPreview();

        // Unsubscribe from events
        if (this._unsubs) {
            this._unsubs.forEach(unsub => unsub?.());
            this._unsubs = null;
        }

        this.scene = null;
    }
}

export const buildingPlacementSystem = new BuildingPlacementSystem();

export default BuildingPlacementSystem;
