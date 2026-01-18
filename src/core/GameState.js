// ============================================================
// VOID SUPREMACY 3D - Game State Manager
// Centralized state management for the game
// ============================================================

import { TEAMS, CONFIG } from './Config.js';
import { eventBus, GameEvents } from './EventBus.js';
import { SpatialGrid, resetSpatialGrid } from '../systems/SpatialGrid.js';

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.running = false;
        this.paused = false;
        this.gameTime = 0;
        this.deltaTime = 0;
        this.playerTeam = TEAMS.PLAYER;

        // Reset and create new spatial grid for efficient neighbor lookups
        resetSpatialGrid();
        this.spatialGrid = new SpatialGrid(50, CONFIG.MAP_SIZE || 2000);

        // Entity collections
        this.entities = [];
        this.units = [];
        this.buildings = [];
        this.projectiles = [];
        this.particles = [];

        // Resource nodes
        this.oreNodes = [];
        this.crystalNodes = [];
        this.asteroids = [];

        // Selection state
        this.selectedEntities = [];
        this.controlGroups = {};

        // Build mode
        this.buildMode = null;
        this.buildPreview = null;

        // Team resources (initialized per team)
        this.resources = {};
        this.stats = {};
        this.hostility = {};

        // Initialize for all teams
        for (let t = 0; t <= 5; t++) {
            this.resources[t] = {
                credits: t < 4 ? 1000 : 5000,
                ore: 0,
                crystals: 0,
                energy: 0,
                maxEnergy: 0,
                supply: 0,
                maxSupply: 0
            };

            this.stats[t] = {
                unitsBuilt: 0,
                unitsLost: 0,
                enemyKilled: 0,
                buildingsBuilt: 0,
                buildingsLost: 0,
                resourcesCollected: 0
            };

            // Initialize hostility matrix
            this.hostility[t] = {};
            for (let t2 = 0; t2 <= 5; t2++) {
                // Players hostile to each other, but not to neutrals initially
                if (t < 4 && t2 < 4 && t !== t2) {
                    this.hostility[t][t2] = true;
                } else {
                    this.hostility[t][t2] = false;
                }
            }
        }
    }

    // ===== Entity Management =====

    addEntity(entity) {
        this.entities.push(entity);

        if (entity.isUnit) {
            this.units.push(entity);
        } else if (entity.isBuilding) {
            this.buildings.push(entity);
        }

        // Add to spatial grid for efficient neighbor lookups
        if (this.spatialGrid) {
            this.spatialGrid.insert(entity);
        }

        eventBus.emit(GameEvents.ENTITY_CREATED, entity);
    }

    removeEntity(entity) {
        // Use swap-and-pop for O(1) removal instead of O(n) splice
        const removeFrom = (arr) => {
            const idx = arr.indexOf(entity);
            if (idx !== -1) {
                arr[idx] = arr[arr.length - 1];
                arr.pop();
            }
        };

        removeFrom(this.entities);
        removeFrom(this.units);
        removeFrom(this.buildings);
        removeFrom(this.selectedEntities);

        // Remove from spatial grid
        if (this.spatialGrid) {
            this.spatialGrid.remove(entity);
        }

        eventBus.emit(GameEvents.ENTITY_DESTROYED, entity);
    }

    getEntitiesByTeam(team) {
        return this.entities.filter(e => e.team === team);
    }

    getUnitsByTeam(team) {
        return this.units.filter(u => u.team === team);
    }

    getBuildingsByTeam(team) {
        return this.buildings.filter(b => b.team === team);
    }

    getBuildingsByType(team, type) {
        return this.buildings.filter(b => b.team === team && b.type === type);
    }

    // ===== Selection Management =====

    select(entity) {
        if (!this.selectedEntities.includes(entity)) {
            this.selectedEntities.push(entity);
            entity.selected = true;
            eventBus.emit(GameEvents.ENTITY_SELECTED, entity);
        }
    }

    deselect(entity) {
        const idx = this.selectedEntities.indexOf(entity);
        if (idx !== -1) {
            this.selectedEntities.splice(idx, 1);
            entity.selected = false;
            eventBus.emit(GameEvents.ENTITY_DESELECTED, entity);
        }
    }

    clearSelection() {
        this.selectedEntities.forEach(e => {
            e.selected = false;
            eventBus.emit(GameEvents.ENTITY_DESELECTED, e);
        });
        this.selectedEntities = [];
        eventBus.emit(GameEvents.UI_SELECTION_CHANGED, []);
    }

    setSelection(entities) {
        this.clearSelection();
        entities.forEach(e => this.select(e));
        eventBus.emit(GameEvents.UI_SELECTION_CHANGED, this.selectedEntities);
    }

    // ===== Control Groups =====

    setControlGroup(num, entities) {
        this.controlGroups[num] = [...entities];
    }

    getControlGroup(num) {
        return this.controlGroups[num] || [];
    }

    // ===== Resource Management =====

    getResources(team) {
        return this.resources[team];
    }

    modifyResource(team, resource, amount) {
        if (this.resources[team]) {
            const oldValue = this.resources[team][resource];
            this.resources[team][resource] += amount;

            eventBus.emit(GameEvents.RESOURCE_CHANGED, {
                team,
                resource,
                oldValue,
                newValue: this.resources[team][resource],
                delta: amount
            });
        }
    }

    canAfford(team, cost) {
        const res = this.resources[team];
        return res && res.credits >= cost;
    }

    spendCredits(team, amount) {
        if (this.canAfford(team, amount)) {
            this.modifyResource(team, 'credits', -amount);
            eventBus.emit(GameEvents.RESOURCE_SPENT, { team, amount });
            return true;
        }
        return false;
    }

    // ===== Diplomacy =====

    isHostile(team1, team2) {
        return this.hostility[team1]?.[team2] || false;
    }

    setHostility(team1, team2, hostile) {
        if (this.hostility[team1]) {
            this.hostility[team1][team2] = hostile;
        }
        if (this.hostility[team2]) {
            this.hostility[team2][team1] = hostile;
        }

        const event = hostile ? GameEvents.DIPLOMACY_WAR : GameEvents.DIPLOMACY_PEACE;
        eventBus.emit(event, { team1, team2 });
    }

    provoke(attackerTeam, victimTeam) {
        if (victimTeam >= TEAMS.NEUTRAL) {
            this.setHostility(attackerTeam, victimTeam, true);
            eventBus.emit(GameEvents.DIPLOMACY_PROVOKED, {
                attacker: attackerTeam,
                victim: victimTeam
            });
        }
    }

    // ===== Stats =====

    recordUnitBuilt(team) {
        this.stats[team].unitsBuilt++;
    }

    recordUnitLost(team) {
        this.stats[team].unitsLost++;
    }

    recordKill(team) {
        this.stats[team].enemyKilled++;
    }

    recordBuildingBuilt(team) {
        this.stats[team].buildingsBuilt++;
    }

    recordBuildingLost(team) {
        this.stats[team].buildingsLost++;
    }

    // ===== Projectiles & Particles =====

    addProjectile(projectile) {
        this.projectiles.push(projectile);
    }

    removeProjectile(projectile) {
        const idx = this.projectiles.indexOf(projectile);
        if (idx !== -1) this.projectiles.splice(idx, 1);
    }

    addParticle(particle) {
        this.particles.push(particle);
    }

    removeParticle(particle) {
        const idx = this.particles.indexOf(particle);
        if (idx !== -1) this.particles.splice(idx, 1);
    }

    // ===== Game Flow =====

    start() {
        this.running = true;
        this.paused = false;
        eventBus.emit(GameEvents.GAME_START, this);
    }

    pause() {
        this.paused = true;
        eventBus.emit(GameEvents.GAME_PAUSE, this);
    }

    resume() {
        this.paused = false;
        eventBus.emit(GameEvents.GAME_RESUME, this);
    }

    end(winner) {
        this.running = false;
        eventBus.emit(GameEvents.GAME_END, { winner, state: this });
    }

    update(deltaTime) {
        if (!this.running || this.paused) return;

        this.deltaTime = deltaTime;
        this.gameTime += deltaTime;

        eventBus.emit(GameEvents.GAME_UPDATE, {
            deltaTime,
            gameTime: this.gameTime
        });
    }

    /**
     * Update spatial grid positions for all moving entities (units)
     * Should be called once per frame after entity positions are updated
     */
    updateSpatialGrid() {
        if (!this.spatialGrid) return;

        // Only units move, buildings are stationary
        for (const unit of this.units) {
            if (!unit.dead) {
                this.spatialGrid.update(unit);
            }
        }
    }

    /**
     * Query entities within radius using spatial grid (O(k) vs O(n))
     * @param {number} x - Center X coordinate
     * @param {number} z - Center Z coordinate
     * @param {number} radius - Search radius
     * @param {Function} [filter] - Optional filter function
     * @returns {Entity[]} Entities within radius
     */
    queryNearbyEntities(x, z, radius, filter = null) {
        if (!this.spatialGrid) {
            // Fallback to brute force if no spatial grid
            return this.entities.filter(e => {
                if (e.dead) return false;
                if (filter && !filter(e)) return false;
                const dx = e.mesh.position.x - x;
                const dz = e.mesh.position.z - z;
                return dx * dx + dz * dz <= radius * radius;
            });
        }
        return this.spatialGrid.queryRadius(x, z, radius, filter);
    }

    /**
     * Get spatial grid statistics for debugging/monitoring
     * @returns {Object} Grid statistics
     */
    getSpatialGridStats() {
        return this.spatialGrid ? this.spatialGrid.getStats() : null;
    }
}

// Singleton instance
export const gameState = new GameState();

export default GameState;
