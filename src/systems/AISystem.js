// ============================================================
// VOID SUPREMACY 3D - AI System
// Handles AI opponent decision making and actions
// ============================================================

import { BUILDINGS, UNITS, CONFIG } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

class AIPlayer {
    constructor(team) {
        this.team = team;
        this.lastAction = 0;
        this.actionInterval = 2000 + Math.random() * 1000;
        this.buildOrder = ['powerPlant', 'refinery', 'shipyard', 'supplyDepot'];
        this.buildIndex = 0;
        this.aggressionLevel = 0.3 + Math.random() * 0.4;

        // Filter caches to reduce redundant array.filter() calls
        this.cacheExpiry = 500; // Cache valid for 500ms
        this.cache = {
            myUnits: { data: null, timestamp: 0 },
            myBuildings: { data: null, timestamp: 0 },
            myMilitary: { data: null, timestamp: 0 },
            myHarvesters: { data: null, timestamp: 0 },
            hostileEntities: { data: null, timestamp: 0 }
        };
    }

    /**
     * Get cached or fresh filtered array
     * @param {string} cacheKey - Cache slot name
     * @param {Function} filterFn - Filter function to apply
     * @param {Array} source - Source array to filter
     * @param {number} now - Current timestamp
     * @returns {Array}
     */
    getCached(cacheKey, filterFn, source, now) {
        const cached = this.cache[cacheKey];
        if (cached.data && (now - cached.timestamp) < this.cacheExpiry) {
            return cached.data;
        }
        cached.data = source.filter(filterFn);
        cached.timestamp = now;
        return cached.data;
    }

    /**
     * Invalidate all caches (call when state changes significantly)
     */
    invalidateCache() {
        for (const key in this.cache) {
            this.cache[key].data = null;
            this.cache[key].timestamp = 0;
        }
    }

    update(now) {
        if (now - this.lastAction < this.actionInterval) return;
        this.lastAction = now;

        const res = gameState.getResources(this.team);

        // Use cached building list to find command center
        const myBuildings = this.getCached(
            'myBuildings',
            e => !e.dead && e.team === this.team,
            gameState.buildings,
            now
        );

        // Find command center
        const cc = myBuildings.find(e => e.type === 'commandCenter');
        if (!cc) return;

        // Build structures
        this.buildStructures(res, cc);

        // Build units
        this.buildUnits(res, now);

        // Command harvesters to gather resources
        this.commandHarvesters(now);

        // Command military units
        this.commandMilitary(now);
    }

    buildStructures(res, cc) {
        if (this.buildIndex >= this.buildOrder.length) return;

        const buildingType = this.buildOrder[this.buildIndex];
        const buildingDef = BUILDINGS[buildingType];

        if (res.credits >= buildingDef.cost) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 20;
            const x = cc.mesh.position.x + Math.cos(angle) * dist;
            const z = cc.mesh.position.z + Math.sin(angle) * dist;

            eventBus.emit(GameEvents.AI_DECISION, {
                team: this.team,
                action: 'build',
                buildingType,
                position: { x, z }
            });

            this.buildIndex++;
        }
    }

    buildUnits(res, now) {
        // Use cached building list
        const myBuildings = this.getCached(
            'myBuildings',
            e => !e.dead && e.team === this.team,
            gameState.buildings,
            now
        );

        // Find shipyard
        const shipyard = myBuildings.find(e =>
            (e.type === 'shipyard' || e.type === 'advancedShipyard') && !e.isConstructing
        );

        if (shipyard && shipyard.buildQueue.length < 3) {
            const unitTypes = ['interceptor', 'striker', 'heavy'];
            const randomUnit = unitTypes[Math.floor(Math.random() * unitTypes.length)];
            shipyard.queueUnit(randomUnit);
        }

        // Build harvesters from command center
        const cc = myBuildings.find(e =>
            e.type === 'commandCenter' && !e.isConstructing
        );

        if (cc && cc.buildQueue.length < 2) {
            // Use cached harvester count
            const harvesters = this.getCached(
                'myHarvesters',
                e => !e.dead && e.team === this.team && e.type === 'harvester',
                gameState.units,
                now
            );
            if (harvesters.length < 3) {
                cc.queueUnit('harvester');
            }
        }
    }

    commandHarvesters(now) {
        // Get idle harvesters
        const harvesters = this.getCached(
            'myHarvesters',
            e => !e.dead && e.team === this.team && e.type === 'harvester',
            gameState.units,
            now
        );

        for (const harvester of harvesters) {
            // Skip if already has a task
            if (harvester.harvestTarget || harvester.command === 'harvest' ||
                harvester.command === 'returnCargo' || harvester.cargo > 0) {
                continue;
            }

            // Find nearest ore node (avoid spread operator in hot path)
            const oreNodes = [];
            for (const node of gameState.oreNodes) {
                if (!node.depleted) oreNodes.push(node);
            }
            for (const node of gameState.crystalNodes) {
                if (!node.depleted) oreNodes.push(node);
            }

            if (oreNodes.length === 0) continue;

            let nearestNode = null;
            let nearestDist = Infinity;

            const pos = harvester.mesh?.position;
            if (!pos) continue;

            for (const node of oreNodes) {
                const dx = node.x - pos.x;
                const dz = node.z - pos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestNode = node;
                }
            }

            if (nearestNode) {
                harvester.harvest(nearestNode);
            }
        }
    }

    commandMilitary(now) {
        // Use cached military units list
        const militaryUnits = this.getCached(
            'myMilitary',
            e => !e.dead && e.team === this.team && e.type !== 'harvester' && !e.attackTarget,
            gameState.units,
            now
        );

        if (militaryUnits.length > 0 && Math.random() < this.aggressionLevel) {
            // Use cached hostile entities
            const targets = this.getCached(
                'hostileEntities',
                e => !e.dead && gameState.isHostile(this.team, e.team),
                gameState.entities,
                now
            );

            if (targets.length > 0) {
                const target = targets[Math.floor(Math.random() * targets.length)];

                eventBus.emit(GameEvents.AI_ATTACK, {
                    team: this.team,
                    units: militaryUnits,
                    target
                });

                for (const unit of militaryUnits) {
                    if (target.mesh) {
                        unit.attackMove(target.mesh.position.x, target.mesh.position.z);
                    }
                }
            }
        }
    }
}

export class AISystem {
    constructor() {
        this.aiPlayers = [];
        this.enabled = true;
    }

    init() {
        this.aiPlayers = [];

        // Create AI players for enemy teams
        for (let t = 1; t < 1 + CONFIG.NUM_AI_PLAYERS; t++) {
            this.aiPlayers.push(new AIPlayer(t));
        }

        // Listen for AI decision events to create buildings
        eventBus.on(GameEvents.AI_DECISION, (data) => {
            if (data.action === 'build') {
                this.handleAIBuild(data);
            }
        });
    }

    handleAIBuild(data) {
        const buildingDef = BUILDINGS[data.buildingType];
        const res = gameState.getResources(data.team);

        if (res.credits >= buildingDef.cost) {
            gameState.spendCredits(data.team, buildingDef.cost);

            eventBus.emit(GameEvents.BUILDING_PLACED, {
                team: data.team,
                type: data.buildingType,
                position: data.position
            });
        }
    }

    update() {
        if (!this.enabled) return;

        const now = performance.now();
        for (const ai of this.aiPlayers) {
            ai.update(now);
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    dispose() {
        this.aiPlayers = [];
    }
}

export const aiSystem = new AISystem();

export default AISystem;
