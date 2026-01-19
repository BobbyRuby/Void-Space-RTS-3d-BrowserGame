// ============================================================
// VOID SUPREMACY 3D - Selection System
// Handles entity selection, control groups, and commands
// ============================================================

import { TEAMS } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

export class SelectionSystem {
    constructor() {
        this.controlGroups = {};
        this.isDragging = false;
        this.dragStart = null;
        this.dragEnd = null;
    }

    init() {
        // Set up event listeners - store unsubscribe functions for cleanup
        this._unsubs = [
            eventBus.on(GameEvents.INPUT_CLICK, (data) => {
                this.handleClick(data);
            }),

            eventBus.on(GameEvents.INPUT_DRAG_END, (data) => {
                this.handleBoxSelect(data);
            })
        ];
    }

    // ===== Single Selection =====

    selectEntity(entity, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }

        if (!gameState.selectedEntities.includes(entity)) {
            gameState.select(entity);
        }

        eventBus.emit(GameEvents.UI_SELECTION_CHANGED, {
            selected: gameState.selectedEntities
        });
    }

    deselectEntity(entity) {
        gameState.deselect(entity);

        eventBus.emit(GameEvents.UI_SELECTION_CHANGED, {
            selected: gameState.selectedEntities
        });
    }

    clearSelection() {
        gameState.clearSelection();
    }

    // ===== Box Selection =====

    handleBoxSelect(data) {
        const { startX, startZ, endX, endZ, addToSelection } = data;

        console.log('handleBoxSelect called with:', { startX, startZ, endX, endZ });

        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minZ = Math.min(startZ, endZ);
        const maxZ = Math.max(startZ, endZ);

        console.log('Box bounds:', { minX, maxX, minZ, maxZ });

        if (!addToSelection) {
            this.clearSelection();
        }

        // Select all player units in the box (not buildings)
        let checkedCount = 0;
        let selectedCount = 0;
        for (const entity of gameState.entities) {
            if (entity.dead || entity.team !== TEAMS.PLAYER || !entity.isUnit) continue;

            const pos = entity.mesh?.position;
            if (!pos) {
                console.log('Entity has no mesh position:', entity.type, entity.id);
                continue;
            }

            checkedCount++;
            console.log(`Checking ${entity.type} at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) against box`);

            if (pos.x >= minX && pos.x <= maxX &&
                pos.z >= minZ && pos.z <= maxZ) {
                gameState.select(entity);
                selectedCount++;
                console.log(`  -> SELECTED!`);
            }
        }
        console.log(`Box select: checked ${checkedCount} units, selected ${selectedCount}`);

        eventBus.emit(GameEvents.UI_SELECTION_CHANGED, {
            selected: gameState.selectedEntities
        });
    }

    // ===== Click Selection =====

    handleClick(data) {
        const { entity, addToSelection } = data;

        if (entity) {
            // Clicked on an entity
            if (entity.team === TEAMS.PLAYER) {
                this.selectEntity(entity, addToSelection);
            } else {
                // Clicked on enemy - if we have units selected, attack
                this.commandAttack(entity);
            }
        } else {
            // Clicked on empty space
            if (!addToSelection) {
                this.clearSelection();
            }
        }
    }

    // ===== Control Groups =====

    setControlGroup(num) {
        this.controlGroups[num] = [...gameState.selectedEntities];
        gameState.setControlGroup(num, gameState.selectedEntities);

        eventBus.emit(GameEvents.UI_ALERT, {
            message: `Group ${num} set`,
            type: 'info',
            team: TEAMS.PLAYER
        });
    }

    selectControlGroup(num, addToSelection = false) {
        const group = this.controlGroups[num] || [];
        const aliveUnits = group.filter(e => !e.dead);

        if (aliveUnits.length === 0) return;

        if (!addToSelection) {
            this.clearSelection();
        }

        for (const entity of aliveUnits) {
            gameState.select(entity);
        }

        eventBus.emit(GameEvents.UI_SELECTION_CHANGED, {
            selected: gameState.selectedEntities
        });
    }

    // ===== Commands =====

    commandMove(x, z) {
        const units = this.getSelectedUnits();
        for (const unit of units) {
            unit.moveTo(x, z);
        }
        if (units.length > 0) {
            eventBus.emit(GameEvents.COMMAND_COMPLETE, { command: 'move' });
        }
    }

    commandAttackMove(x, z) {
        const units = this.getSelectedUnits();
        for (const unit of units) {
            unit.attackMove(x, z);
        }
        if (units.length > 0) {
            eventBus.emit(GameEvents.COMMAND_COMPLETE, { command: 'attackMove' });
        }
    }

    commandAttack(target) {
        const units = this.getSelectedUnits();
        for (const unit of units) {
            if (unit.def.damage) { // Only combat units
                unit.attack(target);
            }
        }
        if (units.length > 0) {
            eventBus.emit(GameEvents.COMMAND_COMPLETE, { command: 'attack' });
        }
    }

    commandStop() {
        const units = this.getSelectedUnits();
        for (const unit of units) {
            unit.stop();
        }
        if (units.length > 0) {
            eventBus.emit(GameEvents.COMMAND_COMPLETE, { command: 'stop' });
        }
    }

    commandHold() {
        const units = this.getSelectedUnits();
        for (const unit of units) {
            unit.hold();
        }
        if (units.length > 0) {
            eventBus.emit(GameEvents.COMMAND_COMPLETE, { command: 'hold' });
        }
    }

    commandPatrol(x, z) {
        const units = this.getSelectedUnits();
        for (const unit of units) {
            const currentX = unit.mesh.position.x;
            const currentZ = unit.mesh.position.z;
            unit.patrol([
                { x: currentX, z: currentZ },
                { x, z }
            ]);
        }
        if (units.length > 0) {
            eventBus.emit(GameEvents.COMMAND_COMPLETE, { command: 'patrol' });
        }
    }

    commandGuard(target) {
        const units = this.getSelectedUnits();
        for (const unit of units) {
            unit.guardTarget = target;
            unit.command = 'guard';
            // Move to guard position
            if (target.mesh) {
                unit.moveTo(target.mesh.position.x, target.mesh.position.z);
            } else if (target.x !== undefined) {
                unit.moveTo(target.x, target.z);
            }
        }
        if (units.length > 0) {
            eventBus.emit(GameEvents.COMMAND_COMPLETE, { command: 'guard' });
        }
    }

    commandGuardPosition(x, z) {
        const units = this.getSelectedUnits();
        for (const unit of units) {
            unit.guardTarget = { x, z };
            unit.command = 'guard';
            unit.moveTo(x, z);
        }
        if (units.length > 0) {
            eventBus.emit(GameEvents.COMMAND_COMPLETE, { command: 'guard' });
        }
    }

    commandHarvest(oreNode) {
        const harvesters = this.getSelectedHarvesters();
        for (const harvester of harvesters) {
            harvester.harvest(oreNode);
        }
        if (harvesters.length > 0) {
            eventBus.emit(GameEvents.COMMAND_COMPLETE, { command: 'harvest' });
        }
    }

    // ===== Helpers =====

    getSelectedUnits() {
        return gameState.selectedEntities.filter(e =>
            e.isUnit && e.team === TEAMS.PLAYER && !e.dead
        );
    }

    getSelectedHarvesters() {
        return this.getSelectedUnits().filter(u => u.type === 'harvester');
    }

    getSelectedBuildings() {
        return gameState.selectedEntities.filter(e =>
            e.isBuilding && e.team === TEAMS.PLAYER && !e.dead
        );
    }

    hasSelection() {
        return gameState.selectedEntities.length > 0;
    }

    getSelectionType() {
        if (gameState.selectedEntities.length === 0) return null;

        const hasUnits = gameState.selectedEntities.some(e => e.isUnit);
        const hasBuildings = gameState.selectedEntities.some(e => e.isBuilding);

        if (hasUnits && hasBuildings) return 'mixed';
        if (hasUnits) return 'units';
        if (hasBuildings) return 'buildings';
        return null;
    }

    dispose() {
        // Unsubscribe from event bus listeners
        this._unsubs?.forEach(unsub => unsub?.());
        this._unsubs = null;

        this.controlGroups = {};
    }
}

export const selectionSystem = new SelectionSystem();

export default SelectionSystem;
