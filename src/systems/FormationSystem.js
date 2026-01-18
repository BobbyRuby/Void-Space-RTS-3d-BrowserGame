// ============================================================
// VOID SUPREMACY 3D - Formation Movement System
// Group movement patterns and coordination
// ============================================================

import { CONFIG, TEAMS } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { pathfinding } from './Pathfinding.js';

// Formation types
export const FormationType = {
    LINE: 'line',
    COLUMN: 'column',
    WEDGE: 'wedge',
    BOX: 'box',
    CIRCLE: 'circle',
    SPREAD: 'spread',
    CUSTOM: 'custom'
};

// Formation presets with offset patterns
const FORMATION_PATTERNS = {
    [FormationType.LINE]: (index, total, spacing) => {
        const offset = index - (total - 1) / 2;
        return { x: offset * spacing, z: 0 };
    },

    [FormationType.COLUMN]: (index, total, spacing) => {
        return { x: 0, z: index * spacing };
    },

    [FormationType.WEDGE]: (index, total, spacing) => {
        if (index === 0) return { x: 0, z: 0 };
        const row = Math.floor((Math.sqrt(8 * index + 1) - 1) / 2);
        const posInRow = index - (row * (row + 1)) / 2;
        const rowWidth = row + 1;
        const xOffset = (posInRow - (rowWidth - 1) / 2) * spacing;
        return { x: xOffset, z: row * spacing * 0.866 };
    },

    [FormationType.BOX]: (index, total, spacing) => {
        const cols = Math.ceil(Math.sqrt(total));
        const row = Math.floor(index / cols);
        const col = index % cols;
        const xOffset = (col - (cols - 1) / 2) * spacing;
        const zOffset = (row - Math.floor(total / cols - 1) / 2) * spacing;
        return { x: xOffset, z: zOffset };
    },

    [FormationType.CIRCLE]: (index, total, spacing) => {
        if (total === 1) return { x: 0, z: 0 };
        const angle = (index / total) * Math.PI * 2;
        const radius = spacing * total / (2 * Math.PI);
        return {
            x: Math.cos(angle) * radius,
            z: Math.sin(angle) * radius
        };
    },

    [FormationType.SPREAD]: (index, total, spacing) => {
        // Fibonacci spiral for optimal spread
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const angle = index * goldenAngle;
        const radius = spacing * Math.sqrt(index);
        return {
            x: Math.cos(angle) * radius,
            z: Math.sin(angle) * radius
        };
    }
};

export class Formation {
    constructor(units, type = FormationType.BOX) {
        this.id = `formation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.units = [...units];
        this.type = type;
        this.spacing = 25; // Base spacing between units
        this.targetPosition = null;
        this.targetRotation = 0;
        this.positions = new Map(); // unit -> assigned position offset
        this.leader = null;
        this.speed = 0; // Slowest unit determines formation speed

        this.calculateFormation();
    }

    calculateFormation() {
        if (this.units.length === 0) return;

        // Sort units by type/importance for position assignment
        this.units.sort((a, b) => {
            const priority = { heavy: 0, cruiser: 1, frigate: 2, striker: 3, interceptor: 4, scout: 5 };
            return (priority[a.type] || 10) - (priority[b.type] || 10);
        });

        // Assign leader (first unit, usually heaviest)
        this.leader = this.units[0];

        // Calculate slowest unit speed
        this.speed = Math.min(...this.units.map(u => u.stats?.speed || 50));

        // Get formation pattern function
        const patternFn = FORMATION_PATTERNS[this.type] || FORMATION_PATTERNS[FormationType.BOX];

        // Calculate positions
        this.positions.clear();
        for (let i = 0; i < this.units.length; i++) {
            const offset = patternFn(i, this.units.length, this.spacing);
            this.positions.set(this.units[i], offset);
        }
    }

    setType(type) {
        this.type = type;
        this.calculateFormation();
    }

    setSpacing(spacing) {
        this.spacing = spacing;
        this.calculateFormation();
    }

    addUnit(unit) {
        if (!this.units.includes(unit)) {
            this.units.push(unit);
            this.calculateFormation();
        }
    }

    removeUnit(unit) {
        const idx = this.units.indexOf(unit);
        if (idx !== -1) {
            this.units.splice(idx, 1);
            this.positions.delete(unit);

            if (unit === this.leader && this.units.length > 0) {
                this.calculateFormation();
            }
        }
    }

    getUnitTargetPosition(unit) {
        if (!this.targetPosition) return null;

        const offset = this.positions.get(unit);
        if (!offset) return this.targetPosition;

        // Rotate offset based on formation facing
        const cos = Math.cos(this.targetRotation);
        const sin = Math.sin(this.targetRotation);

        return {
            x: this.targetPosition.x + offset.x * cos - offset.z * sin,
            z: this.targetPosition.z + offset.x * sin + offset.z * cos
        };
    }

    moveTo(x, z) {
        this.targetPosition = { x, z };

        // Calculate formation facing (average direction from current positions)
        if (this.leader && this.leader.mesh) {
            const leaderPos = this.leader.mesh.position;
            this.targetRotation = Math.atan2(z - leaderPos.z, x - leaderPos.x);
        }
    }

    isComplete() {
        return this.units.every(unit => {
            if (!unit.mesh) return true;

            const target = this.getUnitTargetPosition(unit);
            if (!target) return true;

            const pos = unit.mesh.position;
            const dx = target.x - pos.x;
            const dz = target.z - pos.z;

            return Math.sqrt(dx * dx + dz * dz) < 5;
        });
    }
}

export class FormationSystem {
    constructor() {
        this.formations = new Map(); // id -> Formation
        this.unitFormations = new Map(); // unit -> Formation

        // Separation parameters for local avoidance
        this.separationWeight = 1.5;
        this.separationRadius = 20;
        this.cohesionWeight = 0.5;
        this.alignmentWeight = 0.3;
    }

    init() {
        this.setupEventListeners();
        console.log('Formation System initialized');
    }

    setupEventListeners() {
        eventBus.on(GameEvents.ENTITY_DESTROYED, (entity) => {
            this.removeUnitFromFormation(entity);
        });
    }

    // ===== Formation Management =====

    createFormation(units, type = FormationType.BOX) {
        // Filter valid units
        const validUnits = units.filter(u => !u.dead && !u.isBuilding && u.mesh);
        if (validUnits.length === 0) return null;

        // Remove units from existing formations
        for (const unit of validUnits) {
            this.removeUnitFromFormation(unit);
        }

        // Create new formation
        const formation = new Formation(validUnits, type);
        this.formations.set(formation.id, formation);

        // Map units to formation
        for (const unit of validUnits) {
            this.unitFormations.set(unit, formation);
        }

        return formation;
    }

    getFormation(formationId) {
        return this.formations.get(formationId);
    }

    getUnitFormation(unit) {
        return this.unitFormations.get(unit);
    }

    removeUnitFromFormation(unit) {
        const formation = this.unitFormations.get(unit);
        if (formation) {
            formation.removeUnit(unit);
            this.unitFormations.delete(unit);

            // Dissolve formation if too few units
            if (formation.units.length < 2) {
                this.dissolveFormation(formation.id);
            }
        }
    }

    dissolveFormation(formationId) {
        const formation = this.formations.get(formationId);
        if (formation) {
            for (const unit of formation.units) {
                this.unitFormations.delete(unit);
            }
            this.formations.delete(formationId);
        }
    }

    // ===== Movement Commands =====

    moveFormation(formation, targetX, targetZ) {
        formation.moveTo(targetX, targetZ);

        // Calculate paths for each unit
        for (const unit of formation.units) {
            const unitTarget = formation.getUnitTargetPosition(unit);
            if (!unitTarget || !unit.mesh) continue;

            const pos = unit.mesh.position;
            const path = pathfinding.findPath(pos.x, pos.z, unitTarget.x, unitTarget.z);

            if (path) {
                unit.path = path;
                unit.pathIndex = 0;
                unit.formationTarget = unitTarget;
            } else {
                // Direct movement if no path found
                unit.path = [unitTarget];
                unit.pathIndex = 0;
                unit.formationTarget = unitTarget;
            }
        }
    }

    moveUnitsInFormation(units, targetX, targetZ, formationType = FormationType.BOX) {
        // Create or update formation
        let formation = this.getSharedFormation(units);

        if (!formation || !this.sameUnits(formation.units, units)) {
            formation = this.createFormation(units, formationType);
        }

        if (formation) {
            this.moveFormation(formation, targetX, targetZ);
        }

        return formation;
    }

    getSharedFormation(units) {
        if (units.length === 0) return null;

        const formation = this.unitFormations.get(units[0]);
        if (!formation) return null;

        // Check if all units are in the same formation
        for (const unit of units) {
            if (this.unitFormations.get(unit) !== formation) {
                return null;
            }
        }

        return formation;
    }

    sameUnits(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        const set = new Set(arr1);
        return arr2.every(u => set.has(u));
    }

    // ===== Flocking Behaviors =====

    calculateFlockingForce(unit, neighbors) {
        const pos = unit.mesh.position;
        const separation = { x: 0, z: 0 };
        const cohesion = { x: 0, z: 0 };
        const alignment = { x: 0, z: 0 };

        let separationCount = 0;
        let cohesionCount = 0;
        let alignmentCount = 0;

        for (const neighbor of neighbors) {
            if (neighbor === unit || !neighbor.mesh) continue;

            const nPos = neighbor.mesh.position;
            const dx = pos.x - nPos.x;
            const dz = pos.z - nPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Separation
            if (dist < this.separationRadius && dist > 0) {
                separation.x += dx / dist;
                separation.z += dz / dist;
                separationCount++;
            }

            // Cohesion
            cohesion.x += nPos.x;
            cohesion.z += nPos.z;
            cohesionCount++;

            // Alignment (match velocity)
            if (neighbor.velocity) {
                alignment.x += neighbor.velocity.x || 0;
                alignment.z += neighbor.velocity.z || 0;
                alignmentCount++;
            }
        }

        const force = { x: 0, z: 0 };

        // Apply separation
        if (separationCount > 0) {
            force.x += (separation.x / separationCount) * this.separationWeight;
            force.z += (separation.z / separationCount) * this.separationWeight;
        }

        // Apply cohesion
        if (cohesionCount > 0) {
            const centerX = cohesion.x / cohesionCount;
            const centerZ = cohesion.z / cohesionCount;
            force.x += (centerX - pos.x) * this.cohesionWeight * 0.01;
            force.z += (centerZ - pos.z) * this.cohesionWeight * 0.01;
        }

        // Apply alignment
        if (alignmentCount > 0) {
            force.x += (alignment.x / alignmentCount) * this.alignmentWeight * 0.1;
            force.z += (alignment.z / alignmentCount) * this.alignmentWeight * 0.1;
        }

        return force;
    }

    // ===== Update Loop =====

    update(deltaTime) {
        // Update each formation
        for (const [id, formation] of this.formations) {
            this.updateFormation(formation, deltaTime);
        }

        // Apply flocking to units in formations
        for (const [unit, formation] of this.unitFormations) {
            if (unit.dead || !unit.mesh) continue;

            // Use spatial grid for efficient neighbor lookup within separation radius
            // This reduces O(n²) to O(k) where k is the number of nearby units
            const pos = unit.mesh.position;
            const neighbors = gameState.queryNearbyEntities(
                pos.x, pos.z, this.separationRadius * 2, // Query slightly larger radius
                u => u !== unit && !u.dead && u.mesh && this.unitFormations.get(u) === formation
            );

            // Calculate and apply flocking force
            const flockForce = this.calculateFlockingForce(unit, neighbors);

            // Add to unit's steering
            if (!unit.steeringForce) {
                unit.steeringForce = { x: 0, z: 0 };
            }
            unit.steeringForce.x += flockForce.x;
            unit.steeringForce.z += flockForce.z;
        }
    }

    updateFormation(formation, deltaTime) {
        // Check for dead units
        const deadUnits = formation.units.filter(u => u.dead);
        for (const unit of deadUnits) {
            this.removeUnitFromFormation(unit);
        }

        // Update formation speed if units changed
        if (formation.units.length > 0) {
            formation.speed = Math.min(...formation.units.map(u => u.stats?.speed || 50));
        }
    }

    // ===== Utility =====

    getFormationCenter(formation) {
        if (formation.units.length === 0) return null;

        let sumX = 0, sumZ = 0;
        let count = 0;

        for (const unit of formation.units) {
            if (unit.mesh) {
                sumX += unit.mesh.position.x;
                sumZ += unit.mesh.position.z;
                count++;
            }
        }

        if (count === 0) return null;

        return {
            x: sumX / count,
            z: sumZ / count
        };
    }

    cycleFormationType(formation) {
        const types = Object.values(FormationType);
        const currentIndex = types.indexOf(formation.type);
        const nextIndex = (currentIndex + 1) % (types.length - 1); // Skip CUSTOM
        formation.setType(types[nextIndex]);
        return formation.type;
    }

    dispose() {
        this.formations.clear();
        this.unitFormations.clear();
    }
}

export const formationSystem = new FormationSystem();

export default FormationSystem;
