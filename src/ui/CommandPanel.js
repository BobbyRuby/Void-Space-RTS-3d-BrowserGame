// ============================================================
// VOID SUPREMACY 3D - Command Panel UI (Section Component)
// Action buttons for selected units/buildings
// Renders into MainPanel's command section
// ============================================================

import { CONFIG, TEAMS } from '../core/Config.js?v=20260119';
import { eventBus, GameEvents } from '../core/EventBus.js?v=20260119';
import { gameState } from '../core/GameState.js?v=20260119';
import { FormationType } from '../systems/FormationSystem.js?v=20260119';

// Command types
export const CommandType = {
    MOVE: 'move',
    ATTACK: 'attack',
    STOP: 'stop',
    HOLD: 'hold',
    PATROL: 'patrol',
    GUARD: 'guard',
    HARVEST: 'harvest',
    RETURN_CARGO: 'returnCargo',
    BUILD: 'build',
    CANCEL: 'cancel',
    FORMATION: 'formation',
    ABILITY: 'ability'
};

export class CommandPanel {
    constructor() {
        this.container = null;
        this.commandGrid = null;
        this.selectedEntities = [];
        this.parentSection = null;

        // Command definitions
        // Hotkeys designed to avoid conflicts with camera controls (WASD, Q, E)
        this.commands = {
            [CommandType.MOVE]: {
                icon: '➡️',
                name: 'Move',
                hotkey: 'M',
                description: 'Move to location',
                available: (entities) => entities.some(e => !e.isBuilding),
                action: () => this.startMoveCommand()
            },
            [CommandType.ATTACK]: {
                icon: '⚔️',
                name: 'Attack',
                hotkey: 'G',
                description: 'Attack-move to location',
                available: (entities) => entities.some(e => e.stats?.damage > 0 || e.def?.damage > 0),
                action: () => this.startAttackCommand()
            },
            [CommandType.STOP]: {
                icon: '⏹️',
                name: 'Stop',
                hotkey: 'X',
                description: 'Stop current action',
                available: (entities) => entities.some(e => !e.isBuilding),
                action: () => this.stopCommand()
            },
            [CommandType.HOLD]: {
                icon: '🛑',
                name: 'Hold',
                hotkey: 'H',
                description: 'Hold position and attack nearby enemies',
                available: (entities) => entities.some(e => e.stats?.damage > 0 || e.def?.damage > 0),
                action: () => this.holdCommand()
            },
            [CommandType.PATROL]: {
                icon: '🔄',
                name: 'Patrol',
                hotkey: 'P',
                description: 'Patrol between points',
                available: (entities) => entities.some(e => !e.isBuilding),
                action: () => this.startPatrolCommand()
            },
            [CommandType.GUARD]: {
                icon: '🛡️',
                name: 'Guard',
                hotkey: 'Z',
                description: 'Guard a unit or position',
                available: (entities) => entities.some(e => e.stats?.damage > 0 || e.def?.damage > 0),
                action: () => this.startGuardCommand()
            },
            [CommandType.HARVEST]: {
                icon: '⛏️',
                name: 'Harvest',
                hotkey: 'V',
                description: 'Gather resources',
                available: (entities) => entities.some(e => e.type === 'harvester'),
                action: () => this.startHarvestCommand()
            },
            [CommandType.RETURN_CARGO]: {
                icon: '🏠',
                name: 'Return',
                hotkey: 'R',
                description: 'Return cargo to refinery',
                available: (entities) => entities.some(e => e.type === 'harvester' && e.cargo > 0),
                action: () => this.returnCargoCommand()
            },
            [CommandType.FORMATION]: {
                icon: '📐',
                name: 'Formation',
                hotkey: 'F',
                description: 'Cycle formation type',
                available: (entities) => entities.filter(e => !e.isBuilding).length > 1,
                action: () => this.cycleFormation()
            },
            [CommandType.CANCEL]: {
                icon: '❌',
                name: 'Cancel',
                hotkey: 'Esc',
                description: 'Cancel current production',
                available: (entities) => entities.some(e => e.isBuilding && (e.productionQueue?.length > 0 || e.buildQueue?.length > 0)),
                action: () => this.cancelProduction()
            }
        };

        // Current command mode
        this.commandMode = null;
        this.currentFormation = FormationType.BOX;
    }

    init(parentSection) {
        this.parentSection = parentSection;
        this.createUI();
        this.setupEventListeners();
        console.log('Command Panel initialized');
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'commandPanel';
        this.container.innerHTML = `
            <div class="section-header">
                <span class="command-title">COMMANDS</span>
                <span class="command-mode" id="commandModeDisplay"></span>
            </div>
            <div class="command-content">
                <div class="command-grid" id="commandGrid"></div>
                <div class="formation-display" id="formationDisplay">
                    Formation: <span id="currentFormation">Box</span>
                </div>
            </div>
        `;

        // Append to parent section
        if (this.parentSection) {
            this.parentSection.appendChild(this.container);
        }

        this.commandGrid = document.getElementById('commandGrid');

        // Initialize with empty state
        this.updateCommands();
    }

    setupEventListeners() {
        // Store unsubscribe functions for cleanup
        this._unsubs = [
            eventBus.on(GameEvents.UI_SELECTION_CHANGED, (data) => {
                this.onSelectionChanged(data.selected || data.entities || (Array.isArray(data) ? data : []));
            }),

            // Listen for command completions
            eventBus.on(GameEvents.COMMAND_COMPLETE, () => {
                this.clearCommandMode();
            })
        ];
    }

    onSelectionChanged(selection) {
        this.selectedEntities = selection || [];
        this.updateCommands();
    }

    updateCommands() {
        this.commandGrid.innerHTML = '';

        const hasSelection = this.selectedEntities.length > 0;

        for (const [type, cmd] of Object.entries(this.commands)) {
            const isAvailable = hasSelection && cmd.available(this.selectedEntities);
            const isActive = this.commandMode === type;

            const btn = document.createElement('div');
            btn.className = `command-btn ${!isAvailable ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            btn.dataset.command = type;

            btn.innerHTML = `
                <span class="command-hotkey">${cmd.hotkey}</span>
                <span class="command-icon">${cmd.icon}</span>
                <span class="command-name">${cmd.name}</span>
            `;

            btn.title = cmd.description;

            if (isAvailable) {
                btn.addEventListener('click', () => {
                    cmd.action();
                    this.updateCommands();
                });
            }

            this.commandGrid.appendChild(btn);
        }

        // Update formation display
        const formationEl = document.getElementById('currentFormation');
        if (formationEl) {
            formationEl.textContent =
                this.currentFormation.charAt(0).toUpperCase() + this.currentFormation.slice(1);
        }
    }

    // ===== Command Handlers =====

    startMoveCommand() {
        eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, { mode: 'move' });
        document.body.classList.add('cursor-move');
    }

    startAttackCommand() {
        eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, { mode: 'attackMove' });
        document.body.classList.add('cursor-attack');
    }

    stopCommand() {
        for (const entity of this.selectedEntities) {
            if (!entity.isBuilding) {
                entity.target = null;
                entity.path = null;
                entity.command = 'idle';
                eventBus.emit(GameEvents.UNIT_STOP, entity);
            }
        }
    }

    holdCommand() {
        for (const entity of this.selectedEntities) {
            if (!entity.isBuilding) {
                entity.target = null;
                entity.path = null;
                entity.command = 'hold';
                entity.holdPosition = entity.mesh ? {
                    x: entity.mesh.position.x,
                    z: entity.mesh.position.z
                } : null;
                eventBus.emit(GameEvents.UNIT_HOLD, entity);
            }
        }
    }

    startPatrolCommand() {
        eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, { mode: 'patrol' });
        document.body.classList.add('cursor-patrol');
    }

    startGuardCommand() {
        eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, { mode: 'guard' });
        document.body.classList.add('cursor-guard');
    }

    startHarvestCommand() {
        eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, { mode: 'harvest' });
        document.body.classList.add('cursor-harvest');
    }

    returnCargoCommand() {
        for (const entity of this.selectedEntities) {
            if (entity.type === 'harvester' && entity.cargo > 0 && entity.mesh) {
                // Find nearest refinery using cached building list
                const refineries = gameState.getBuildingsByType(entity.team, 'refinery')
                    .filter(r => !r.dead && !r.isConstructing && r.mesh);

                if (refineries.length > 0) {
                    const pos = entity.mesh.position;
                    let nearest = refineries[0];
                    let nearestDistSq = Infinity;

                    // Use squared distance to avoid sqrt (faster for comparison)
                    for (const ref of refineries) {
                        const dx = ref.mesh.position.x - pos.x;
                        const dz = ref.mesh.position.z - pos.z;
                        const distSq = dx * dx + dz * dz;
                        if (distSq < nearestDistSq) {
                            nearestDistSq = distSq;
                            nearest = ref;
                        }
                    }

                    entity.command = 'returnCargo';
                    entity.returnTarget = nearest;
                    eventBus.emit(GameEvents.HARVESTER_RETURN, { harvester: entity, target: nearest });
                }
            }
        }
    }

    cycleFormation() {
        const formations = Object.values(FormationType).filter(f => f !== FormationType.CUSTOM);
        const currentIndex = formations.indexOf(this.currentFormation);
        this.currentFormation = formations[(currentIndex + 1) % formations.length];

        eventBus.emit(GameEvents.FORMATION_CHANGED, {
            units: this.selectedEntities.filter(e => !e.isBuilding),
            formation: this.currentFormation
        });

        this.updateCommands();
    }

    cancelProduction() {
        for (const entity of this.selectedEntities) {
            if (entity.isBuilding && entity.productionQueue?.length > 0) {
                eventBus.emit(GameEvents.PRODUCTION_CANCEL, {
                    building: entity,
                    index: 0 // Cancel current
                });
            }
        }
    }

    // ===== Command Mode =====

    setCommandMode(mode) {
        this.commandMode = mode;
        const modeDisplay = document.getElementById('commandModeDisplay');
        if (modeDisplay) {
            modeDisplay.textContent = mode ? this.commands[mode]?.name.toUpperCase() : '';
        }
    }

    clearCommandMode() {
        this.commandMode = null;
        const modeDisplay = document.getElementById('commandModeDisplay');
        if (modeDisplay) {
            modeDisplay.textContent = '';
        }

        // Remove all cursor classes
        document.body.classList.remove(
            'cursor-move', 'cursor-attack', 'cursor-patrol',
            'cursor-guard', 'cursor-harvest'
        );
    }

    getCommandMode() {
        return this.commandMode;
    }

    // ===== Hotkey Handling =====

    handleHotkey(key) {
        const upperKey = key.toUpperCase();

        for (const [type, cmd] of Object.entries(this.commands)) {
            if (cmd.hotkey.toUpperCase() === upperKey) {
                if (this.selectedEntities.length > 0 && cmd.available(this.selectedEntities)) {
                    cmd.action();
                    this.updateCommands();
                    return true;
                }
            }
        }

        // Escape cancels command mode
        if (key === 'Escape') {
            this.clearCommandMode();
            return true;
        }

        return false;
    }

    // ===== Visibility (Deprecated - always visible now) =====

    show() {
        // No-op: Always visible in MainPanel
    }

    hide() {
        // No-op: Always visible in MainPanel
    }

    isVisible() {
        return true; // Always visible
    }

    dispose() {
        // Unsubscribe from event bus listeners
        this._unsubs?.forEach(unsub => unsub?.());
        this._unsubs = null;

        this.clearCommandMode();
        if (this.container) {
            this.container.remove();
        }
        const style = document.getElementById('commandPanelStyles');
        if (style) {
            style.remove();
        }
    }
}

export const commandPanel = new CommandPanel();

export default CommandPanel;
